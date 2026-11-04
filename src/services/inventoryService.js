import { SELLABLE } from '../utils/sql.js';

/**
 * Locks this branch's sellable batches of a medicine (earliest expiry first) and splits the
 * requested quantity across them. Returns null parts plus what is available when stock is short.
 * Must run inside a transaction: FOR UPDATE holds the rows until commit so two tills cannot sell the same unit.
 */
export async function allocateFefo(conn, branchId, medicineId, quantity) {
  const [batches] = await conn.query(
    `SELECT b.batch_id, b.qty_on_hand, b.expiry_date
       FROM tbl_batches b
      WHERE b.branch_id = ? AND b.medicine_id = ? AND b.qty_on_hand > 0 AND ${SELLABLE}
      ORDER BY b.expiry_date, b.batch_id
      FOR UPDATE`,
    [branchId, medicineId],
  );
  const available = batches.reduce((sum, b) => sum + b.qty_on_hand, 0);
  if (available < quantity) return { parts: null, available };

  const parts = [];
  let remaining = quantity;
  for (const batch of batches) {
    if (remaining === 0) break;
    const take = Math.min(batch.qty_on_hand, remaining);
    parts.push({ batch_id: batch.batch_id, quantity: take, expiry_date: batch.expiry_date });
    remaining -= take;
  }
  return { parts, available };
}

/** Applies a signed quantity change to a batch and records it in the stock ledger. */
export async function moveStock(conn, { batchId, branchId, userId, type, qtyChange, refType = null, refId = null, reason = null }) {
  await conn.query('UPDATE tbl_batches SET qty_on_hand = qty_on_hand + ? WHERE batch_id = ?', [qtyChange, batchId]);
  await conn.query(
    `INSERT INTO tbl_stock_movements (batch_id, branch_id, user_id, type, qty_change, ref_type, ref_id, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [batchId, branchId, userId, type, qtyChange, refType, refId, reason],
  );
}
