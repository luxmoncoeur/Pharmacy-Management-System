import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loginAs, pool, sellableStock, ledgerMismatches } from './helpers.js';

after(() => pool.end());

const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

test('receiving stock creates a batch and a ledger entry', async () => {
  const pharmacist = await loginAs('pharmacist.main');
  const before = await sellableStock(1, 11);
  const res = await pharmacist.post('/api/batches').send({ medicine_id: 11, supplier: 'Sample Pharma Distributors', batch_no: 'TEST-RCV-1', expiry_date: future(400), cost_price: 12, quantity: 50 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.branch_id, 1, 'stock lands at the pharmacist\'s own branch');
  assert.equal(res.body.data.supplier_name, 'Sample Pharma Distributors');
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

test('sending stock moves units to the other branch in one step, keeping expiry dates', async () => {
  const main = await loginAs('manager.main');
  const mainBefore = await sellableStock(1, 1);
  const northBefore = await sellableStock(2, 1);

  const res = await main.post('/api/transfers').send({ to_branch_id: 2, items: [{ medicine_id: 1, quantity: 30 }], notes: 'Test' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.from_branch_id, 1, 'a branch manager sends from their own branch');
  assert.equal(await sellableStock(1, 1), mainBefore - 30);
  assert.equal(await sellableStock(2, 1), northBefore + 30);

  const lots = res.body.data.lots;
  assert.ok(lots.length > 0);
  for (const lot of lots) {
    const [[src]] = await pool.query('SELECT batch_no, expiry_date, branch_id FROM tbl_batches WHERE batch_id = ?', [lot.from_batch_id]);
    const [[dst]] = await pool.query('SELECT batch_no, expiry_date, branch_id FROM tbl_batches WHERE batch_id = ?', [lot.to_batch_id]);
    assert.deepEqual([src.batch_no, src.expiry_date, src.branch_id], [dst.batch_no, dst.expiry_date, 1]);
    assert.equal(dst.branch_id, 2);
  }
  // Stock history shows both sides, each pointing at the other branch.
  const [moves] = await pool.query(
    "SELECT type, ref_id FROM tbl_stock_movements WHERE ref_type = 'branch' AND batch_id IN (?, ?) ORDER BY movement_id DESC LIMIT 2",
    [lots[0].from_batch_id, lots[0].to_batch_id],
  );
  assert.deepEqual(moves.map((m) => m.type).sort(), ['transfer_in', 'transfer_out']);
  assert.equal(await ledgerMismatches(), 0);
});

test('sending stock fails (and moves nothing) when the branch lacks stock', async () => {
  const main = await loginAs('manager.main');
  const before = await sellableStock(1, 2);
  const res = await main.post('/api/transfers').send({ to_branch_id: 2, items: [{ medicine_id: 2, quantity: 99999 }] });
  assert.equal(res.status, 409);
  assert.ok(res.body.errors['items.0']);
  assert.equal(await sellableStock(1, 2), before);
});

test('a branch manager cannot send stock from another branch', async () => {
  const north = await loginAs('manager.north');
  const res = await north.post('/api/transfers').send({ from_branch_id: 1, to_branch_id: 2, items: [{ medicine_id: 1, quantity: 1 }] });
  assert.equal(res.status, 403);
});

test('a pharmacist can remove expired stock but not record a count correction', async () => {
  const pharmacist = await loginAs('pharmacist.main');
  const [[batch]] = await pool.query('SELECT batch_id, qty_on_hand FROM tbl_batches WHERE branch_id = 1 AND qty_on_hand > 0 AND expiry_date <= CURDATE() LIMIT 1');
  const removed = await pharmacist.post(`/api/batches/${batch.batch_id}/adjust`).send({ type: 'write_off', qty_change: -batch.qty_on_hand, reason: 'Expired' });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.qty_on_hand, 0);
  const correction = await pharmacist.post(`/api/batches/${batch.batch_id}/adjust`).send({ type: 'adjust', qty_change: 5, reason: 'Found' });
  assert.equal(correction.status, 403);
  assert.equal(await ledgerMismatches(), 0);
});

test('owner alerts count shortages per branch, not combined stock', async () => {
  const admin = await loginAs('manager');
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

const lotBody = (b, changes) => ({ batch_no: b.batch_no, expiry_date: b.expiry_date, cost_price: b.cost_price, supplier: b.supplier, ...changes });

test('an expired lot cannot be re-dated to make it sellable again', async () => {
  const manager = await loginAs('manager.main');
  const [[lot]] = await pool.query('SELECT * FROM tbl_batches WHERE branch_id = 1 AND expiry_date <= CURDATE() AND qty_on_hand > 0 LIMIT 1');
  const res = await manager.patch(`/api/batches/${lot.batch_id}`).send(lotBody(lot, { expiry_date: future(365) }));
  assert.equal(res.status, 409);
  assert.ok(res.body.errors.expiry_date);
  const [[after]] = await pool.query('SELECT expiry_date FROM tbl_batches WHERE batch_id = ?', [lot.batch_id]);
  assert.equal(after.expiry_date, lot.expiry_date, 'the expiry date is unchanged');
  const costOnly = await manager.patch(`/api/batches/${lot.batch_id}`).send(lotBody(lot, { cost_price: 1.5 }));
  assert.equal(costOnly.status, 200, 'other details of an expired lot can still be corrected');
});

test('a lot that has sold units can only have its expiry moved earlier', async () => {
  const manager = await loginAs('manager.main');
  const [[lot]] = await pool.query(
    `SELECT b.* FROM tbl_batches b WHERE b.branch_id = 1 AND b.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND EXISTS (SELECT 1 FROM tbl_stock_movements m WHERE m.batch_id = b.batch_id AND m.type = 'sale') LIMIT 1`,
  );
  const later = new Date(Date.parse(lot.expiry_date) + 365 * 86400000).toISOString().slice(0, 10);
  assert.equal((await manager.patch(`/api/batches/${lot.batch_id}`).send(lotBody(lot, { expiry_date: later }))).status, 409);
  assert.equal((await manager.patch(`/api/batches/${lot.batch_id}`).send(lotBody(lot, { expiry_date: '2020-01-01' }))).status, 400, 'cannot set a past date');
  const earlier = new Date(Date.parse(lot.expiry_date) - 86400000).toISOString().slice(0, 10);
  assert.equal((await manager.patch(`/api/batches/${lot.batch_id}`).send(lotBody(lot, { expiry_date: earlier }))).status, 200);
});

test('a typo in a new, unsold lot\'s expiry can be fixed', async () => {
  const manager = await loginAs('manager.main');
  const rcv = await manager.post('/api/batches').send({ medicine_id: 11, batch_no: 'TEST-TYPO', expiry_date: future(200), cost_price: 5, quantity: 10 });
  assert.equal(rcv.status, 201);
  const res = await manager.patch(`/api/batches/${rcv.body.data.batch_id}`).send(lotBody(rcv.body.data, { expiry_date: future(500) }));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.expiry_date, future(500));
});

test('a second delivery of the same lot adds to it; a different expiry is refused', async () => {
  const pharmacist = await loginAs('pharmacist.main');
  const body = { medicine_id: 11, batch_no: 'TEST-AGAIN', expiry_date: future(300), cost_price: 10, quantity: 20 };
  const first = await pharmacist.post('/api/batches').send(body);
  assert.equal(first.status, 201);
  const again = await pharmacist.post('/api/batches').send({ ...body, quantity: 15 });
  assert.equal(again.status, 200);
  assert.equal(again.body.data.batch_id, first.body.data.batch_id, 'units go into the same lot');
  assert.equal(again.body.data.qty_on_hand, 35);
  assert.equal(await ledgerMismatches(), 0);

  const typo = await pharmacist.post('/api/batches').send({ ...body, expiry_date: future(301) });
  assert.equal(typo.status, 409);
  assert.ok(typo.body.errors.batch_no);
});
