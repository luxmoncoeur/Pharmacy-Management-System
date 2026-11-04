import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loginAs, pool, sellableStock, ledgerMismatches } from './helpers.js';

after(() => pool.end());

test('cash sale deducts stock and computes VAT server-side', async () => {
  const cashier = await loginAs('cashier.main');
  const before = await sellableStock(1, 1);
  const res = await cashier.post('/api/sales').send({
    payment_method: 'cash', amount_tendered: 100, discount_type: 'none', items: [{ medicine_id: 1, quantity: 10 }],
  });
  assert.equal(res.status, 201);
  const sale = res.body.data;
  assert.match(sale.receipt_no, /^OR-01-\d{6}$/);
  assert.equal(sale.total, 55);
  assert.equal(sale.vatable_amount, 49.11);
  assert.equal(sale.vat_amount, 5.89);
  assert.equal(sale.change_due, 45);
  assert.equal(await sellableStock(1, 1), before - 10);
  assert.equal(await ledgerMismatches(), 0);
});

test('FEFO: the earliest-expiring sellable batch is used first', async () => {
  const cashier = await loginAs('cashier.main');
  const [batches] = await pool.query(
    'SELECT batch_id, qty_on_hand FROM tbl_batches WHERE branch_id = 1 AND medicine_id = 3 AND qty_on_hand > 0 AND expiry_date > CURDATE() ORDER BY expiry_date',
  );
  assert.ok(batches.length >= 1);
  const res = await cashier.post('/api/sales').send({ payment_method: 'card', payment_ref: 'T-FEFO', items: [{ medicine_id: 3, quantity: 2 }] });
  assert.equal(res.status, 201);
  const [[item]] = await pool.query('SELECT batch_id FROM tbl_sale_items WHERE sale_id = ?', [res.body.data.sale_id]);
  assert.equal(item.batch_id, batches[0].batch_id);
});

test('a sale larger than one batch is split across batches', async () => {
  const cashier = await loginAs('cashier.main');
  const [batches] = await pool.query(
    'SELECT batch_id, qty_on_hand FROM tbl_batches WHERE branch_id = 1 AND medicine_id = 3 AND qty_on_hand > 0 AND expiry_date > CURDATE() ORDER BY expiry_date',
  );
  if (batches.length < 2) return;
  const qty = batches[0].qty_on_hand + 1;
  const res = await cashier.post('/api/sales').send({ payment_method: 'gcash', payment_ref: 'T-SPLIT', items: [{ medicine_id: 3, quantity: qty }] });
  assert.equal(res.status, 201);
  const [items] = await pool.query('SELECT batch_id, quantity FROM tbl_sale_items WHERE sale_id = ? ORDER BY sale_item_id', [res.body.data.sale_id]);
  assert.deepEqual(items.map((i) => i.quantity), [batches[0].qty_on_hand, 1]);
});

test('expired stock is never sold', async () => {
  const cashier = await loginAs('cashier.main');
  const [[expired]] = await pool.query(
    `SELECT medicine_id FROM tbl_batches WHERE branch_id = 1 AND expiry_date <= CURDATE() AND qty_on_hand > 0
       AND medicine_id IN (SELECT medicine_id FROM tbl_medicines WHERE requires_prescription = 0) LIMIT 1`,
  );
  const sellable = await sellableStock(1, expired.medicine_id);
  const res = await cashier.post('/api/sales').send({ payment_method: 'card', payment_ref: 'T-EXP', items: [{ medicine_id: expired.medicine_id, quantity: sellable + 1 }] });
  assert.equal(res.status, 409);
  assert.ok(res.body.errors['items.0']);
});

test('a failed sale rolls back completely', async () => {
  const cashier = await loginAs('cashier.main');
  const before1 = await sellableStock(1, 1);
  const [[{ n: salesBefore }]] = await pool.query('SELECT COUNT(*) AS n FROM tbl_sales');
  const res = await cashier.post('/api/sales').send({
    payment_method: 'cash', amount_tendered: 999999, items: [{ medicine_id: 1, quantity: 1 }, { medicine_id: 2, quantity: 99999 }],
  });
  assert.equal(res.status, 409);
  assert.equal(await sellableStock(1, 1), before1);
  const [[{ n: salesAfter }]] = await pool.query('SELECT COUNT(*) AS n FROM tbl_sales');
  assert.equal(salesAfter, salesBefore);
});

test('insufficient cash is rejected', async () => {
  const cashier = await loginAs('cashier.main');
  const res = await cashier.post('/api/sales').send({ payment_method: 'cash', amount_tendered: 1, items: [{ medicine_id: 1, quantity: 10 }] });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.amount_tendered);
});

test('prescription-only medicine needs a verified prescription', async () => {
  const cashier = await loginAs('cashier.main');
  const res = await cashier.post('/api/sales').send({ payment_method: 'card', payment_ref: 'T-RX', items: [{ medicine_id: 6, quantity: 1 }] });
  assert.equal(res.status, 409);
  assert.ok(res.body.errors['items.0']);
});

test('prescription workflow: record, verify, dispense partially, then fully', async () => {
  const pharmacist = await loginAs('pharmacist.main');
  const cashier = await loginAs('cashier.main');

  const rx = await pharmacist.post('/api/prescriptions').send({
    customer_id: 3, doctor_name: 'Dr. Test', doctor_license_no: 'MD-T-1', date_issued: new Date().toISOString().slice(0, 10),
    items: [{ medicine_id: 6, quantity: 10, instructions: '1 capsule every 8 hours' }],
  });
  assert.equal(rx.status, 201);
  const rxId = rx.body.data.prescription_id;
  assert.equal(rx.body.data.status, 'pending');

  const early = await cashier.post('/api/sales').send({ prescription_id: rxId, payment_method: 'card', payment_ref: 'T1', items: [{ medicine_id: 6, quantity: 4 }] });
  assert.equal(early.status, 409, 'pending prescriptions cannot be dispensed');

  assert.equal((await cashier.post(`/api/prescriptions/${rxId}/verify`)).status, 403, 'cashiers cannot verify');
  const verified = await pharmacist.post(`/api/prescriptions/${rxId}/verify`);
  assert.equal(verified.body.data.status, 'verified');

  const part = await cashier.post('/api/sales').send({ prescription_id: rxId, payment_method: 'card', payment_ref: 'T2', items: [{ medicine_id: 6, quantity: 4 }] });
  assert.equal(part.status, 201);
  assert.equal(part.body.data.customer_id, 3, 'the sale is linked to the prescription\'s customer');
  assert.equal((await pharmacist.get(`/api/prescriptions/${rxId}`)).body.data.status, 'partially_dispensed');

  const over = await cashier.post('/api/sales').send({ prescription_id: rxId, payment_method: 'card', payment_ref: 'T3', items: [{ medicine_id: 6, quantity: 7 }] });
  assert.equal(over.status, 409, 'cannot dispense more than prescribed');

  const rest = await cashier.post('/api/sales').send({ prescription_id: rxId, payment_method: 'card', payment_ref: 'T4', items: [{ medicine_id: 6, quantity: 6 }] });
  assert.equal(rest.status, 201);
  assert.equal((await pharmacist.get(`/api/prescriptions/${rxId}`)).body.data.status, 'dispensed');

  assert.equal((await pharmacist.delete(`/api/prescriptions/${rxId}`)).status, 409, 'dispensed prescriptions are kept');
});

test('senior discount: VAT-exempt and 20% off', async () => {
  const cashier = await loginAs('cashier.main');
  const res = await cashier.post('/api/sales').send({
    customer_id: 1, discount_type: 'senior', payment_method: 'cash', amount_tendered: 100, items: [{ medicine_id: 1, quantity: 10 }],
  });
  assert.equal(res.status, 201);
  const s = res.body.data;
  assert.equal(s.subtotal, 55);
  assert.equal(s.vat_exempt, 49.11);
  assert.equal(s.discount_amount, 9.82);
  assert.equal(s.total, 39.29);
  assert.equal(s.vat_amount, 0);
  assert.equal(s.discount_id_no, 'SC-SAMPLE-1001');
});

test('discount is refused for a customer without a matching ID', async () => {
  const cashier = await loginAs('cashier.main');
  const res = await cashier.post('/api/sales').send({ customer_id: 3, discount_type: 'senior', payment_method: 'cash', amount_tendered: 100, items: [{ medicine_id: 1, quantity: 1 }] });
  assert.equal(res.status, 400);
});

test('void returns stock to the original batches; only managers can void', async () => {
  const cashier = await loginAs('cashier.main');
  const manager = await loginAs('manager.main');
  const before = await sellableStock(1, 4);
  const sale = await cashier.post('/api/sales').send({ payment_method: 'card', payment_ref: 'T-VOID', items: [{ medicine_id: 4, quantity: 3 }] });
  assert.equal(await sellableStock(1, 4), before - 3);

  assert.equal((await cashier.post(`/api/sales/${sale.body.data.sale_id}/void`).send({ reason: 'x' })).status, 403);
  const voided = await manager.post(`/api/sales/${sale.body.data.sale_id}/void`).send({ reason: 'Customer changed their mind' });
  assert.equal(voided.status, 200);
  assert.equal(voided.body.data.status, 'voided');
  assert.equal(await sellableStock(1, 4), before);
  assert.equal((await manager.post(`/api/sales/${sale.body.data.sale_id}/void`).send({ reason: 'again' })).status, 409);
  assert.equal(await ledgerMismatches(), 0);
});

test('admin has no till and cannot ring up sales', async () => {
  const admin = await loginAs('admin');
  const res = await admin.post('/api/sales').send({ payment_method: 'card', payment_ref: 'X', items: [{ medicine_id: 1, quantity: 1 }] });
  assert.equal(res.status, 403);
});

test('dashboard and reports are computed from data', async () => {
  const manager = await loginAs('manager.main');
  const dash = await manager.get('/api/dashboard');
  assert.equal(dash.status, 200);
  assert.equal(dash.body.data.daily.length, 14);
  const [[today]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS t FROM tbl_sales WHERE branch_id = 1 AND status = 'completed' AND created_at >= CURDATE()");
  assert.equal(dash.body.data.today.revenue, Number(today.t));

  const csv = await manager.get('/api/reports/stock-status?format=csv');
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text, /Generic name,Brand/);
  assert.equal((await manager.get('/api/reports/unknown')).status, 404);
});
