import { withTransaction } from '../config/db.js';
import { allocateFefo, moveStock } from './inventoryService.js';
import { computeTotals, lineTotal } from '../utils/pricing.js';
import { receiptNo } from '../utils/receipt.js';
import { badRequest, conflict, forbidden } from '../utils/http.js';
import { isOwner } from '../middleware/auth.js';

const fieldErrors = (list) => Object.fromEntries(list);

/**
 * Completes a sale in one transaction: validates the cart, enforces prescription rules,
 * draws stock first-expiry-first-out, computes totals server-side, and records everything.
 * If any step fails, nothing is saved and no stock moves.
 */
export async function checkout(req, input) {
  const branchId = req.user.branch_id;
  if (!branchId) throw forbidden('Sales are recorded against a branch. Sign in with a branch account to sell.');

  return withTransaction(async (conn) => {
    const ids = input.items.map((i) => i.medicine_id);
    if (new Set(ids).size !== ids.length) throw badRequest('Each medicine should appear once in the cart.', { items: 'Combine duplicate lines.' });

    const [medicineRows] = await conn.query(
      'SELECT medicine_id, generic_name, brand, strength, price, requires_prescription, is_active FROM tbl_medicines WHERE medicine_id IN (?)', [ids],
    );
    const medicines = new Map(medicineRows.map((m) => [m.medicine_id, m]));
    const unknown = input.items.map((item, i) => [item, i]).filter(([item]) => !medicines.get(item.medicine_id)?.is_active);
    if (unknown.length) {
      throw badRequest('Some items are no longer sold.', fieldErrors(unknown.map(([, i]) => [`items.${i}`, 'This medicine is archived or does not exist.'])));
    }

    let customerId = input.customer_id ?? null;
    let prescription = null;
    const rxLines = input.items.filter((item) => medicines.get(item.medicine_id).requires_prescription);

    if (rxLines.length && !input.prescription_id) {
      throw conflict('Prescription-only medicines need a verified prescription.', fieldErrors(
        input.items.map((item, i) => [item, i]).filter(([item]) => medicines.get(item.medicine_id).requires_prescription)
          .map(([, i]) => [`items.${i}`, 'Link a verified prescription to sell this medicine.']),
      ));
    }

    if (input.prescription_id) {
      const [[rx]] = await conn.query('SELECT * FROM tbl_prescription WHERE prescription_id = ? FOR UPDATE', [input.prescription_id]);
      if (!rx) throw badRequest('Prescription not found.', { prescription_id: 'Choose an existing prescription.' });
      if (rx.branch_id !== branchId) throw conflict('This prescription was recorded at another branch.');
      if (!['verified', 'partially_dispensed'].includes(rx.status)) {
        throw conflict(rx.status === 'pending' ? 'A pharmacist must verify this prescription first.' : `This prescription is ${rx.status.replace('_', ' ')}.`);
      }
      if (customerId && customerId !== rx.customer_id) throw conflict('The prescription belongs to a different customer.', { customer_id: 'Customer does not match the prescription.' });
      customerId = rx.customer_id;

      const [rxItems] = await conn.query('SELECT * FROM tbl_prescribed_items WHERE prescription_id = ? FOR UPDATE', [rx.prescription_id]);
      const byMedicine = new Map(rxItems.map((r) => [r.medicine_id, r]));
      const problems = [];
      input.items.forEach((item, i) => {
        const prescribed = byMedicine.get(item.medicine_id);
        const isRx = medicines.get(item.medicine_id).requires_prescription;
        if (isRx && !prescribed) problems.push([`items.${i}`, 'Not on the linked prescription.']);
        else if (prescribed && item.quantity > prescribed.quantity - prescribed.qty_dispensed) {
          if (isRx) problems.push([`items.${i}`, `Only ${prescribed.quantity - prescribed.qty_dispensed} left to dispense on this prescription.`]);
        }
      });
      if (problems.length) throw conflict('The cart does not match the prescription.', fieldErrors(problems));
      prescription = { ...rx, byMedicine };
    }

    let customer = null;
    if (customerId) {
      const [[c]] = await conn.query('SELECT customer_id, is_active, discount_id_type, discount_id_no FROM tbl_customers WHERE customer_id = ?', [customerId]);
      if (!c?.is_active) throw badRequest('Choose an active customer.', { customer_id: 'Choose an active customer.' });
      customer = c;
    }
    if (input.discount_type !== 'none' && customer?.discount_id_type !== input.discount_type) {
      throw badRequest('This customer has no matching Senior Citizen or PWD ID on file.', { discount_type: 'Add the ID to the customer record first.' });
    }

    const lines = [];
    const shortages = [];
    for (const [i, item] of input.items.entries()) {
      const { parts, available } = await allocateFefo(conn, branchId, item.medicine_id, item.quantity);
      if (!parts) shortages.push([`items.${i}`, available ? `Only ${available} in stock.` : 'Out of stock.']);
      else parts.forEach((p) => lines.push({ ...p, medicine_id: item.medicine_id, unit_price: medicines.get(item.medicine_id).price }));
    }
    if (shortages.length) throw conflict('Not enough sellable stock for some items.', fieldErrors(shortages));

    const totals = computeTotals(lines, input.discount_type);
    let tendered = totals.total;
    if (input.payment_method === 'cash') {
      tendered = input.amount_tendered ?? 0;
      if (tendered < totals.total) {
        throw badRequest('Amount tendered is less than the total.', { amount_tendered: `Collect at least ${totals.total.toFixed(2)}.` });
      }
    }

    const [sale] = await conn.query(
      `INSERT INTO tbl_sales (receipt_no, branch_id, cashier_id, customer_id, prescription_id, subtotal, vatable_amount, vat_amount, vat_exempt,
                              discount_type, discount_id_no, discount_amount, total, payment_method, amount_tendered, payment_ref)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [branchId, req.user.user_id, customerId, prescription?.prescription_id ?? null, totals.subtotal, totals.vatable_amount, totals.vat_amount,
        totals.vat_exempt, input.discount_type, input.discount_type === 'none' ? null : customer.discount_id_no, totals.discount_amount,
        totals.total, input.payment_method, tendered, input.payment_method === 'cash' ? null : input.payment_ref],
    );
    const saleId = sale.insertId;
    await conn.query('UPDATE tbl_sales SET receipt_no = ? WHERE sale_id = ?', [receiptNo(branchId, saleId), saleId]);

    for (const line of lines) {
      await conn.query(
        'INSERT INTO tbl_sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
        [saleId, line.medicine_id, line.batch_id, line.quantity, line.unit_price, lineTotal(line.unit_price, line.quantity)],
      );
      await moveStock(conn, { batchId: line.batch_id, userId: req.user.user_id, type: 'sale', qtyChange: -line.quantity, refType: 'sale', refId: saleId });
    }

    if (prescription) {
      for (const item of input.items) {
        const prescribed = prescription.byMedicine.get(item.medicine_id);
        if (!prescribed) continue;
        const dispense = Math.min(item.quantity, prescribed.quantity - prescribed.qty_dispensed);
        if (dispense > 0) await conn.query('UPDATE tbl_prescribed_items SET qty_dispensed = qty_dispensed + ? WHERE item_id = ?', [dispense, prescribed.item_id]);
      }
      await refreshPrescriptionStatus(conn, prescription.prescription_id);
    }
    return saleId;
  });
}

export async function refreshPrescriptionStatus(conn, prescriptionId) {
  const [[t]] = await conn.query(
    'SELECT SUM(quantity) AS prescribed, SUM(qty_dispensed) AS dispensed FROM tbl_prescribed_items WHERE prescription_id = ?', [prescriptionId],
  );
  const status = Number(t.dispensed) === 0 ? 'verified' : Number(t.dispensed) >= Number(t.prescribed) ? 'dispensed' : 'partially_dispensed';
  await conn.query('UPDATE tbl_prescription SET status = ? WHERE prescription_id = ?', [status, prescriptionId]);
}

/** Reverses a completed sale: returns each unit to the batch it came from and reopens the prescription quantity. */
export async function voidSale(req, saleId, reason) {
  return withTransaction(async (conn) => {
    const [[sale]] = await conn.query('SELECT * FROM tbl_sales WHERE sale_id = ? FOR UPDATE', [saleId]);
    if (!sale) return null;
    if (!isOwner(req.user) && sale.branch_id !== req.user.branch_id) throw forbidden('This sale belongs to another branch.');
    if (sale.status === 'voided') throw conflict('This sale was already voided.');

    const [items] = await conn.query('SELECT * FROM tbl_sale_items WHERE sale_id = ?', [saleId]);
    for (const item of items) {
      await moveStock(conn, {
        batchId: item.batch_id, userId: req.user.user_id, type: 'void_return', qtyChange: item.quantity, refType: 'sale', refId: saleId, reason,
      });
    }

    if (sale.prescription_id) {
      const returned = new Map();
      items.forEach((i) => returned.set(i.medicine_id, (returned.get(i.medicine_id) ?? 0) + i.quantity));
      for (const [medicineId, qty] of returned) {
        await conn.query(
          'UPDATE tbl_prescribed_items SET qty_dispensed = GREATEST(qty_dispensed - ?, 0) WHERE prescription_id = ? AND medicine_id = ?',
          [qty, sale.prescription_id, medicineId],
        );
      }
      await refreshPrescriptionStatus(conn, sale.prescription_id);
    }

    await conn.query("UPDATE tbl_sales SET status = 'voided', voided_by = ?, void_reason = ?, voided_at = NOW() WHERE sale_id = ?", [req.user.user_id, reason, saleId]);
    return saleId;
  });
}
