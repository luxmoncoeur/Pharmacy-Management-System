import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loginAs, pool } from './helpers.js';

after(() => pool.end());

const medicine = {
  generic_name: 'Test Cetirizine', brand: 'TestBrand', category_id: 3, dosage_form: 'Tablet', strength: '10 mg',
  unit: 'tablet', price: 19.5, requires_prescription: false, reorder_level: 10, barcode: '9990000000001',
};

test('medicine CRUD: create, read, update, archive', async () => {
  const admin = await loginAs('admin');
  const created = await admin.post('/api/medicines').send(medicine);
  assert.equal(created.status, 201);
  const id = created.body.data.medicine_id;
  assert.equal(created.body.data.stock_on_hand, 0);
  assert.equal(created.body.data.stock_status, 'out');

  const read = await admin.get(`/api/medicines/${id}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.data.generic_name, 'Test Cetirizine');
  assert.ok(Array.isArray(read.body.data.branches));

  const updated = await admin.put(`/api/medicines/${id}`).send({ ...medicine, price: 21 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.price, 21);
  const [[log]] = await pool.query("SELECT action FROM tbl_audit_log WHERE entity = 'medicine' AND entity_id = ? ORDER BY log_id DESC LIMIT 1", [id]);
  assert.equal(log.action, 'price_change');

  const archived = await admin.delete(`/api/medicines/${id}`);
  assert.equal(archived.status, 200);
  const list = await admin.get('/api/medicines?q=Test Cetirizine');
  assert.equal(list.body.data.length, 0, 'archived medicines are hidden from the default list');
  const all = await admin.get('/api/medicines?q=Test Cetirizine&status=all');
  assert.equal(all.body.data.length, 1);
});

test('rejects duplicates with 409 and a field error', async () => {
  const admin = await loginAs('admin');
  const res = await admin.post('/api/medicines').send({ ...medicine, barcode: '4800000000001', generic_name: 'Another' });
  assert.equal(res.status, 409);
  assert.ok(res.body.errors.barcode);
});

test('validates medicine fields (400)', async () => {
  const admin = await loginAs('admin');
  const res = await admin.post('/api/medicines').send({ ...medicine, price: -5, generic_name: '', category_id: 'abc' });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.price);
  assert.ok(res.body.errors.generic_name);
  assert.ok(res.body.errors.category_id);
});

test('returns 404 for a missing record and 400 for a bad id', async () => {
  const admin = await loginAs('admin');
  assert.equal((await admin.get('/api/medicines/999999')).status, 404);
  assert.equal((await admin.get('/api/medicines/abc')).status, 400);
  assert.equal((await admin.get('/api/nope')).status, 404);
});

test('search and filters narrow the medicine list', async () => {
  const pharmacist = await loginAs('pharmacist.main');
  const rx = await pharmacist.get('/api/medicines?rx=rx&limit=100');
  assert.ok(rx.body.data.length > 0);
  assert.ok(rx.body.data.every((m) => m.requires_prescription === 1));
  const byBarcode = await pharmacist.get('/api/medicines?q=4800000000001');
  assert.equal(byBarcode.body.data[0].brand, 'Biogesic');
  const low = await pharmacist.get('/api/medicines?stock=low&limit=100');
  assert.ok(low.body.data.every((m) => m.stock_status === 'low'));
});

test('customer requires an ID number for a senior discount', async () => {
  const cashier = await loginAs('cashier.main');
  const bad = await cashier.post('/api/customers').send({ firstname: 'Ana', lastname: 'Test', discount_id_type: 'senior' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.discount_id_no);
  const good = await cashier.post('/api/customers').send({ firstname: 'Ana', lastname: 'Test', discount_id_type: 'senior', discount_id_no: 'SC-T-1', birthdate: '1950-01-01' });
  assert.equal(good.status, 201);
  assert.ok(good.body.data.age >= 70);
});

test('category in use cannot be deleted (409)', async () => {
  const manager = await loginAs('manager.main');
  const res = await manager.delete('/api/categories/1');
  assert.equal(res.status, 409);
});

test('the last active administrator cannot be deactivated', async () => {
  const admin = await loginAs('admin');
  const res = await admin.put('/api/users/1').send({ username: 'admin', full_name: 'Alex Reyes', role: 'admin', is_active: false });
  assert.equal(res.status, 409);
});
