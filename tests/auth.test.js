import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { anon, loginAs, pool } from './helpers.js';

after(() => pool.end());

test('rejects requests without a session (401)', async () => {
  const res = await anon().get('/api/medicines');
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('rejects a wrong password with a generic message', async () => {
  const res = await anon().post('/api/auth/login').send({ username: 'admin', password: 'wrong-password' });
  assert.equal(res.status, 401);
  assert.equal(res.body.message, 'Incorrect username or password.');
});

test('validates the login body (400 with field errors)', async () => {
  const res = await anon().post('/api/auth/login').send({ username: '' });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.username);
  assert.ok(res.body.errors.password);
});

test('returns 400 for malformed JSON', async () => {
  const res = await anon().post('/api/auth/login').set('Content-Type', 'application/json').send('{"username":');
  assert.equal(res.status, 400);
});

test('signs in and returns the current user without the password hash', async () => {
  const agent = await loginAs('manager.main');
  const res = await agent.get('/api/auth/me');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'manager');
  assert.equal(res.body.data.password_hash, undefined);
});

test('a cashier cannot create medicines or view reports (403)', async () => {
  const cashier = await loginAs('cashier.main');
  const create = await cashier.post('/api/medicines').send({});
  assert.equal(create.status, 403);
  const report = await cashier.get('/api/reports/daily-sales');
  assert.equal(report.status, 403);
});

test('a manager only sees their own branch', async () => {
  const manager = await loginAs('manager.main');
  const res = await manager.get('/api/sales?branch=2&limit=50');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((s) => s.branch_id === 1), 'manager.main must never receive North Branch sales');
});

test('blocks cross-site POST requests by Origin', async () => {
  const res = await anon().post('/api/auth/login').set('Origin', 'https://evil.example.com').send({ username: 'admin', password: 'x' });
  assert.equal(res.status, 403);
});

test('rejects a weak new password and accepts a strong one', async () => {
  const agent = await loginAs('cashier.north');
  const weak = await agent.patch('/api/auth/me/password').send({ current_password: 'Pharmacy123!', new_password: 'short' });
  assert.equal(weak.status, 400);
  const good = await agent.patch('/api/auth/me/password').send({ current_password: 'Pharmacy123!', new_password: 'NewPassw0rd' });
  assert.equal(good.status, 200);
  const back = await agent.patch('/api/auth/me/password').send({ current_password: 'NewPassw0rd', new_password: 'Pharmacy123!' });
  assert.equal(back.status, 200);
});

test('a deactivated user is signed out on the next request', async () => {
  const admin = await loginAs('admin');
  const created = await admin.post('/api/users').send({ username: 'temp.cashier', full_name: 'Temp Cashier', role: 'cashier', branch_id: 1, password: 'TempPass123' });
  assert.equal(created.status, 201);
  const temp = await loginAs('temp.cashier', 'TempPass123');
  await admin.delete(`/api/users/${created.body.data.user_id}`);
  const res = await temp.get('/api/auth/me');
  assert.equal(res.status, 401);
});
