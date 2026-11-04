import { withTransaction } from '../config/db.js';
import { allocateFefo, moveStock } from './inventoryService.js';
import { audit } from '../utils/audit.js';
import { conflict, forbidden, notFound } from '../utils/http.js';

const canActFor = (req, branchId) => req.user.role === 'admin' || req.user.branch_id === branchId;

async function lockTransfer(conn, id) {
  const [[transfer]] = await conn.query('SELECT * FROM tbl_transfers WHERE transfer_id = ? FOR UPDATE', [id]);
  if (!transfer) throw notFound('Transfer');
  return transfer;
}

/** Source branch ships the stock: FEFO-picks batches and takes the units out of the source branch. */
export const dispatchTransfer = (req, id) => withTransaction(async (conn) => {
  const transfer = await lockTransfer(conn, id);
  if (!canActFor(req, transfer.from_branch_id)) throw forbidden('Only the sending branch can dispatch this transfer.');
  if (transfer.status !== 'requested') throw conflict(`This transfer is already ${transfer.status.replace('_', ' ')}.`);

  const [items] = await conn.query('SELECT * FROM tbl_transfer_items WHERE transfer_id = ?', [id]);
  const allocations = [];
  const shortages = {};
  for (const [i, item] of items.entries()) {
    const { parts, available } = await allocateFefo(conn, transfer.from_branch_id, item.medicine_id, item.quantity);
    if (!parts) shortages[`items.${i}`] = available ? `Only ${available} in stock.` : 'Out of stock.';
    else allocations.push({ item, parts });
  }
  if (Object.keys(shortages).length) throw conflict('The sending branch does not have enough sellable stock.', shortages);

  // One transfer line per source batch so the receiving branch inherits the correct expiry dates.
  await conn.query('DELETE FROM tbl_transfer_items WHERE transfer_id = ?', [id]);
  for (const { item, parts } of allocations) {
    for (const part of parts) {
      await conn.query('INSERT INTO tbl_transfer_items (transfer_id, medicine_id, quantity, batch_id) VALUES (?, ?, ?, ?)', [id, item.medicine_id, part.quantity, part.batch_id]);
      await moveStock(conn, {
        batchId: part.batch_id, branchId: transfer.from_branch_id, userId: req.user.user_id, type: 'transfer_out', qtyChange: -part.quantity, refType: 'transfer', refId: id,
      });
    }
  }
  await conn.query("UPDATE tbl_transfers SET status = 'in_transit', dispatched_by = ?, dispatched_at = NOW() WHERE transfer_id = ?", [req.user.user_id, id]);
  await audit(req, 'dispatch', 'transfer', id, null, conn);
});

/** Destination branch confirms arrival: stock lands in a batch with the same number and expiry as its source. */
export const receiveTransfer = (req, id) => withTransaction(async (conn) => {
  const transfer = await lockTransfer(conn, id);
  if (!canActFor(req, transfer.to_branch_id)) throw forbidden('Only the receiving branch can confirm this transfer.');
  if (transfer.status !== 'in_transit') throw conflict('Only transfers in transit can be received.');

  const [items] = await conn.query(
    `SELECT ti.*, b.batch_no, b.expiry_date, b.cost_price, b.supplier_id
       FROM tbl_transfer_items ti JOIN tbl_batches b ON b.batch_id = ti.batch_id WHERE ti.transfer_id = ?`, [id],
  );
  for (const item of items) {
    const [[existing]] = await conn.query(
      'SELECT batch_id FROM tbl_batches WHERE medicine_id = ? AND branch_id = ? AND batch_no = ? FOR UPDATE',
      [item.medicine_id, transfer.to_branch_id, item.batch_no],
    );
    let destId = existing?.batch_id;
    if (!destId) {
      const [r] = await conn.query(
        `INSERT INTO tbl_batches (medicine_id, branch_id, supplier_id, batch_no, expiry_date, cost_price, qty_received, qty_on_hand)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [item.medicine_id, transfer.to_branch_id, item.supplier_id, item.batch_no, item.expiry_date, item.cost_price, item.quantity],
      );
      destId = r.insertId;
    }
    await moveStock(conn, {
      batchId: destId, branchId: transfer.to_branch_id, userId: req.user.user_id, type: 'transfer_in', qtyChange: item.quantity, refType: 'transfer', refId: id,
    });
    await conn.query('UPDATE tbl_transfer_items SET dest_batch_id = ? WHERE transfer_item_id = ?', [destId, item.transfer_item_id]);
  }
  await conn.query("UPDATE tbl_transfers SET status = 'received', received_by = ?, received_at = NOW() WHERE transfer_id = ?", [req.user.user_id, id]);
  await audit(req, 'receive', 'transfer', id, null, conn);
});

/** Cancels a request, or a shipment still in transit (its stock goes back to the source batches). */
export const cancelTransfer = (req, id) => withTransaction(async (conn) => {
  const transfer = await lockTransfer(conn, id);
  if (!canActFor(req, transfer.from_branch_id) && !canActFor(req, transfer.to_branch_id)) throw forbidden();
  if (!['requested', 'in_transit'].includes(transfer.status)) throw conflict(`A ${transfer.status} transfer cannot be cancelled.`);

  if (transfer.status === 'in_transit') {
    const [items] = await conn.query('SELECT * FROM tbl_transfer_items WHERE transfer_id = ?', [id]);
    for (const item of items) {
      await moveStock(conn, {
        batchId: item.batch_id, branchId: transfer.from_branch_id, userId: req.user.user_id, type: 'transfer_in', qtyChange: item.quantity,
        refType: 'transfer', refId: id, reason: 'Transfer cancelled in transit',
      });
    }
  }
  await conn.query("UPDATE tbl_transfers SET status = 'cancelled' WHERE transfer_id = ?", [id]);
  await audit(req, 'cancel', 'transfer', id, { was: transfer.status }, conn);
});
