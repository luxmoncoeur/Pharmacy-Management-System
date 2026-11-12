import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loginAs, pool } from './helpers.js';

after(() => pool.end());

const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const userId = async (username) => (await pool.query('SELECT user_id FROM tbl_users WHERE username = ?', [username]))[0][0].user_id;
const ids = (res) => res.body.data.map((n) => n.id);

test('a pharmacist is notified of a new prescription, and the cashier when it is checked', async () => {
  const cashier = await loginAs('cashier.main');
  const pharmacist = await loginAs('pharmacist.main');
  const rx = await cashier.post('/api/prescriptions').send({
    customer_id: 3, doctor_name: 'Dr. Notify', doctor_license_no: 'MD-N-1', date_issued: today(), items: [{ medicine_id: 6, quantity: 3 }],
  });
  const rxId = rx.body.data.prescription_id;

  const forPharmacist = await pharmacist.get('/api/notifications');
  assert.equal(forPharmacist.status, 200);
  assert.ok(ids(forPharmacist).includes(`rx_pending:${rxId}`));
  const pendingTotal = (await pharmacist.get('/api/prescriptions').query({ status: 'pending', limit: 1 })).body.meta.total;
  assert.equal(forPharmacist.body.meta.counts.prescriptions, pendingTotal, 'the sidebar count matches the pending list');

  await pharmacist.post(`/api/prescriptions/${rxId}/verify`);
  const forCashier = await cashier.get('/api/notifications');
  const item = forCashier.body.data.find((n) => n.id === `rx_reviewed:${rxId}:verified`);
  assert.ok(item, 'the cashier who recorded it is told it was checked');
  assert.equal(item.link, `#/prescriptions/${rxId}`);
  assert.ok(!ids(await pharmacist.get('/api/notifications')).includes(`rx_pending:${rxId}`), 'no longer pending for the pharmacist');
});

test('cashiers get no stock or license notifications; pharmacists get stock ones', async () => {
  const cashier = await loginAs('cashier.main');
  const types = (await cashier.get('/api/notifications')).body.data.map((n) => n.type);
  assert.ok(types.every((t) => !t.startsWith('stock_') && t !== 'license' && t !== 'rx_pending' && t !== 'sale_voided'));
  const pharmacist = await loginAs('pharmacist.main');
  assert.ok((await pharmacist.get('/api/notifications')).body.data.some((n) => n.type.startsWith('stock_')));
});

test('a voided sale is shown to the owner but not to the manager who voided it', async () => {
  const cashier = await loginAs('cashier.main');
  const manager = await loginAs('manager.main');
  const owner = await loginAs('manager');
  const sale = await cashier.post('/api/sales').send({ payment_method: 'cash', amount_tendered: 100, items: [{ medicine_id: 1, quantity: 1 }] });
  await manager.post(`/api/sales/${sale.body.data.sale_id}/void`).send({ reason: 'Wrong item' });

  const key = `sale_voided:${sale.body.data.sale_id}`;
  assert.ok(ids(await owner.get('/api/notifications')).includes(key));
  assert.ok(!ids(await manager.get('/api/notifications')).includes(key));
});

test('cash summary adds up one person\'s sales for the day', async () => {
  const cashier = await loginAs('cashier.main');
  const before = (await cashier.get('/api/cash/summary')).body.data;
  const cash = await cashier.post('/api/sales').send({ payment_method: 'cash', amount_tendered: 500, items: [{ medicine_id: 1, quantity: 3 }] });
  const gcash = await cashier.post('/api/sales').send({ payment_method: 'gcash', payment_ref: 'G-CASH-1', items: [{ medicine_id: 1, quantity: 2 }] });
  const res = await cashier.get('/api/cash/summary');
  assert.equal(res.status, 200);
  const s = res.body.data;
  assert.equal(s.person.user_id, await userId('cashier.main'));
  assert.equal(s.date, today());
  assert.equal(s.transactions, before.transactions + 2);
  assert.equal(Math.round((s.cash - before.cash) * 100), Math.round(cash.body.data.total * 100));
  assert.equal(Math.round((s.gcash - before.gcash) * 100), Math.round(gcash.body.data.total * 100));
});

test('cash summary access: own day only for staff, own branch for managers', async () => {
  const cashier = await loginAs('cashier.main');
  const northCashier = await userId('cashier.north');
  const mainCashier = await userId('cashier.main');
  assert.equal((await cashier.get('/api/cash/summary').query({ cashier: northCashier })).status, 403);
  assert.equal((await cashier.get('/api/cash/summary').query({ date: '2026-01-01' })).status, 403, 'only managers look at past days');
  assert.equal((await cashier.get('/api/cash/summary').query({ date: '2999-01-01' })).status, 400);

  assert.equal((await (await loginAs('manager.main')).get('/api/cash/summary').query({ cashier: mainCashier })).status, 200);
  assert.equal((await (await loginAs('manager.north')).get('/api/cash/summary').query({ cashier: mainCashier })).status, 403);

  const owner = await loginAs('manager');
  assert.equal((await owner.get('/api/cash/summary')).status, 400, 'the owner has no till and must choose someone');
  assert.equal((await owner.get('/api/cash/summary').query({ cashier: northCashier })).status, 200);
});
