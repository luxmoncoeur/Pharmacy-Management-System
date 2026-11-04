import { withTransaction } from '../config/db.js';
import { allocateFefo, moveStock } from './inventoryService.js';
import { conflict } from '../utils/http.js';

/**
 * Sends stock from one branch to another in a single step. Units leave the sending branch
 * earliest-expiry-first and arrive in a lot with the same lot number and expiry at the receiving branch.
 * There is no separate transfer table: each move is two lines in stock history, each pointing at the
 * other branch (ref_type 'branch'). If any medicine is short, nothing moves.
 */
export const sendStock = (req, { fromBranchId, toBranchId, notes, items, branchNames }) => withTransaction(async (conn) => {
  const allocations = [];
  const shortages = {};
  for (const [i, item] of items.entries()) {
    const { parts, available } = await allocateFefo(conn, fromBranchId, item.medicine_id, item.quantity);
    if (!parts) shortages[`items.${i}`] = available ? `Only ${available} in stock.` : 'Out of stock.';
    else allocations.push({ item, parts });
  }
  if (Object.keys(shortages).length) throw conflict('The sending branch does not have enough stock.', shortages);

  const note = notes ? `: ${notes}` : '';
  const moved = [];
  for (const { item, parts } of allocations) {
    for (const part of parts) {
      const [[source]] = await conn.query('SELECT batch_no, expiry_date, cost_price, supplier FROM tbl_batches WHERE batch_id = ?', [part.batch_id]);
      await moveStock(conn, {
        batchId: part.batch_id, userId: req.user.user_id, type: 'transfer_out', qtyChange: -part.quantity,
        refType: 'branch', refId: toBranchId, reason: `Sent to ${branchNames.to}${note}`,
      });

      const [[existing]] = await conn.query(
        'SELECT batch_id FROM tbl_batches WHERE medicine_id = ? AND branch_id = ? AND batch_no = ? FOR UPDATE',
        [item.medicine_id, toBranchId, source.batch_no],
      );
      let destId = existing?.batch_id;
      if (!destId) {
        const [b] = await conn.query(
          `INSERT INTO tbl_batches (medicine_id, branch_id, supplier, batch_no, expiry_date, cost_price, qty_on_hand)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [item.medicine_id, toBranchId, source.supplier, source.batch_no, source.expiry_date, source.cost_price],
        );
        destId = b.insertId;
      }
      await moveStock(conn, {
        batchId: destId, userId: req.user.user_id, type: 'transfer_in', qtyChange: part.quantity,
        refType: 'branch', refId: fromBranchId, reason: `From ${branchNames.from}${note}`,
      });
      moved.push({
        medicine_id: item.medicine_id, quantity: part.quantity, batch_no: source.batch_no, expiry_date: source.expiry_date,
        from_batch_id: part.batch_id, to_batch_id: destId,
      });
    }
  }
  return moved;
});
