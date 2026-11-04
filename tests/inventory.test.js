import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loginAs, pool, sellableStock, ledgerMismatches } from './helpers.js';

after(() => pool.end());

const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

test('receiving stock creates a batch and a ledger entry', async () => {
  const pharmacist = await loginAs('pharmacist.main');
  const before = await sellableStock(1, 11);
  const res = await pharmacist.post('/api/batches').send({ medicine_id: 11, supplier_id: 1, batch_no: 'TEST-RCV-1', expiry_date: future(400), cost_price: 12, quantity: 50 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.branch_id, 1, 'stock lands at the pharmacist\'s own branch');
  assert.equal(await sellableStock(1, 11), before + 50);
  assert.equal(await ledgerMismatches(), 0);
});

test('refuses to receive already-expired stock', async () => {
  const pharmacist = await loginAs('pharmacist.main');
  const res = await pharmacist.post('/api/batches').send({ medicine_id: 11, batch_no: 'TEST-OLD', expiry_date: '2020-01-01', cost_price: 1, quantity: 5 });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.expiry_date);
});

test('adjustment cannot push a batch below zero', async () => {
  const manager = await loginAs('manager.main');
  const [[batch]] = await pool.query('SELECT batch_id, qty_on_hand FROM tbl_batches WHERE branch_id = 1 AND qty_on_hand > 0 LIMIT 1');
  const res = await manager.post(`/api/batches/${batch.batch_id}/adjust`).send({ type: 'adjust', qty_change: -(batch.qty_on_hand + 1), reason: 'Recount' });
  assert.equal(res.status, 409);
  const okRes = await manager.post(`/api/batches/${batch.batch_id}/adjust`).send({ type: 'adjust', qty_change: -1, reason: 'Recount' });
  assert.equal(okRes.status, 200);
  assert.equal(okRes.body.data.qty_on_hand, batch.qty_on_hand - 1);
  assert.equal(await ledgerMismatches(), 0);
});

test('a manager cannot adjust another branch\'s batch', async () => {
  const manager = await loginAs('manager.north');
  const [[batch]] = await pool.query('SELECT batch_id FROM tbl_batches WHERE branch_id = 1 LIMIT 1');
  const res = await manager.post(`/api/batches/${batch.batch_id}/adjust`).send({ type: 'adjust', qty_change: 1, reason: 'x' });
  assert.equal(res.status, 403);
});

test('alerts list expired, near-expiry and low-stock items', async () => {
  const manager = await loginAs('manager.main');
  const res = await manager.get('/api/inventory/alerts');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.expired.every((b) => b.expiry_status === 'expired'));
  assert.ok(res.body.data.near_expiry.every((b) => b.expiry_status === 'near'));
  assert.ok(res.body.data.expired.length > 0 && res.body.data.near_expiry.length > 0 && res.body.data.low_stock.length > 0);
});

test('transfer moves stock between branches and conserves units', async () => {
  const north = await loginAs('manager.north');
  const main = await loginAs('manager.main');
  const mainBefore = await sellableStock(1, 1);
  const northBefore = await sellableStock(2, 1);

  const req = await north.post('/api/transfers').send({ from_branch_id: 1, to_branch_id: 2, items: [{ medicine_id: 1, quantity: 30 }] });
  assert.equal(req.status, 201);
  const id = req.body.data.transfer_id;

  assert.equal((await north.post(`/api/transfers/${id}/dispatch`)).status, 403, 'only the sending branch dispatches');
  assert.equal((await main.post(`/api/transfers/${id}/dispatch`)).status, 200);
  assert.equal(await sellableStock(1, 1), mainBefore - 30);
  assert.equal(await sellableStock(2, 1), northBefore, 'units in transit belong to neither branch yet');

  assert.equal((await north.post(`/api/transfers/${id}/receive`)).status, 200);
  assert.equal(await sellableStock(2, 1), northBefore + 30);
  assert.equal((await north.post(`/api/transfers/${id}/receive`)).status, 409, 'cannot receive twice');
  assert.equal(await ledgerMismatches(), 0);
});

test('transfer dispatch fails when the source lacks stock', async () => {
  const north = await loginAs('manager.north');
  const main = await loginAs('manager.main');
  const req = await north.post('/api/transfers').send({ from_branch_id: 1, to_branch_id: 2, items: [{ medicine_id: 2, quantity: 99999 }] });
  const res = await main.post(`/api/transfers/${req.body.data.transfer_id}/dispatch`);
  assert.equal(res.status, 409);
  assert.ok(res.body.errors['items.0']);
});

test('admin alerts count shortages per branch, not combined stock', async () => {
  const admin = await loginAs('admin');
  const all = await admin.get('/api/inventory/alerts');
  const north = await loginAs('manager.north');
  const northAlerts = await north.get('/api/inventory/alerts');
  for (const item of northAlerts.body.data.low_stock) {
    assert.ok(all.body.data.low_stock.some((x) => x.medicine_id === item.medicine_id && x.branch_id === 2),
      `North shortage of medicine ${item.medicine_id} must appear in the all-branches view`);
  }
  const dash = await admin.get('/api/dashboard');
  assert.equal(Number(dash.body.data.stock.low_stock), all.body.data.low_stock.length);
});
