// Generates database/seed.sql: fictional sample data for demos and tests.
// Dates are written relative to CURDATE()/NOW() so expiry alerts stay meaningful whenever the seed is loaded.
// Stock levels are simulated (receive, earliest-expiry-first sales, transfer, correction) so batch quantities always
// reconcile with tbl_stock_movements.
import { writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { computeTotals, lineTotal } from '../src/utils/pricing.js';
import { receiptNo } from '../src/utils/receipt.js';

const DEMO_PASSWORD = 'Pharmacy123!';
const SALE_DAYS = 28;

let seed = 20261104;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v.raw) return v.raw;
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
};
const raw = (sql) => ({ raw: sql });
const dayExpr = (offset) => raw(offset >= 0
  ? `DATE_ADD(CURDATE(), INTERVAL ${offset} DAY)`
  : `DATE_SUB(CURDATE(), INTERVAL ${-offset} DAY)`);
// A moment `daysAgo` days back at hh:mm. Today's entries are placed minutes before NOW() so none are in the future.
const momentExpr = (daysAgo, minuteOfDay) => raw(daysAgo === 0
  ? `DATE_SUB(NOW(), INTERVAL ${minuteOfDay} MINUTE)`
  : `DATE_ADD(DATE_SUB(CURDATE(), INTERVAL ${daysAgo} DAY), INTERVAL ${minuteOfDay} MINUTE)`);

const out = [];
const insert = (table, rows) => {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    out.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES\n` +
      chunk.map((r) => `  (${cols.map((c) => q(r[c])).join(', ')})`).join(',\n') + ';\n');
  }
};

const branches = [
  { branch_id: 1, name: 'Main Branch', address: 'Sample address: 101 Rizal Avenue, Poblacion', phone: '0430000101', code: 'MN' },
  { branch_id: 2, name: 'North Branch', address: 'Sample address: 22 Mabini Street, Barangay Uno', phone: '0430000202', code: 'NR' },
];

const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
const users = [
  { user_id: 1, branch_id: null, username: 'manager', full_name: 'Alex Reyes', role: 'manager' },
  { user_id: 2, branch_id: 1, username: 'manager.main', full_name: 'Bea Santos', role: 'manager' },
  { user_id: 3, branch_id: 1, username: 'pharmacist.main', full_name: 'Carlo Mendoza', role: 'pharmacist', license_no: 'PRC-SAMPLE-0001', license_expiry: dayExpr(540) },
  { user_id: 4, branch_id: 1, username: 'cashier.main', full_name: 'Dana Cruz', role: 'cashier' },
  { user_id: 5, branch_id: 2, username: 'manager.north', full_name: 'Ellis Garcia', role: 'manager' },
  { user_id: 6, branch_id: 2, username: 'pharmacist.north', full_name: 'Faye Villanueva', role: 'pharmacist', license_no: 'PRC-SAMPLE-0002', license_expiry: dayExpr(24) },
  { user_id: 7, branch_id: 2, username: 'cashier.north', full_name: 'Gabe Ramos', role: 'cashier' },
].map((u) => ({ license_no: null, license_expiry: null, ...u, password_hash: hash, is_active: 1 }));

const customers = [
  ['Isabel', 'Aquino', 'senior', 'SC-SAMPLE-1001'],
  ['Jose', 'Bautista', 'senior', 'SC-SAMPLE-1002'],
  ['Karen', 'Castillo', 'none', null],
  ['Leo', 'Dizon', 'none', null],
  ['Maria', 'Estrada', 'pwd', 'PWD-SAMPLE-2001'],
  ['Nico', 'Fernandez', 'none', null],
  ['Olivia', 'Gonzales', 'senior', 'SC-SAMPLE-1003'],
  ['Paolo', 'Hernandez', 'none', null],
  ['Rosa', 'Ignacio', 'senior', 'SC-SAMPLE-1004'],
  ['Sam', 'Jimenez', 'none', null],
  ['Tina', 'Lopez', 'none', null],
  ['Victor', 'Manalo', 'none', null],
  ['Wendy', 'Navarro', 'none', null],
  ['Xavier', 'Ocampo', 'senior', 'SC-SAMPLE-1005'],
  ['Yna', 'Pascual', 'none', null],
].map(([firstname, lastname, type, idNo], i) => ({
  customer_id: i + 1, firstname, lastname,
  phone: `0917100${String(i + 1).padStart(4, '0')}`,
  discount_id_type: type, discount_id_no: idNo, is_active: 1,
}));

const suppliers = ['Sample Pharma Distributors', 'Demo Medical Supply Co.', 'Placeholder Health Trading'];

// [generic, brand, category, form, strength, unit, price, rx, reorder]
const medicineRows = [
  ['Paracetamol', 'Biogesic', 'Analgesics', 'Tablet', '500 mg', 'tablet', 5.5, 0, 100],
  ['Paracetamol', 'Calpol', 'Analgesics', 'Syrup', '250 mg/5 mL', 'bottle', 145, 0, 10],
  ['Ibuprofen', 'Advil', 'Analgesics', 'Capsule', '200 mg', 'capsule', 9.75, 0, 60],
  ['Mefenamic Acid', 'Dolfenal', 'Analgesics', 'Capsule', '500 mg', 'capsule', 12, 0, 60],
  ['Naproxen Sodium', 'Flanax', 'Analgesics', 'Tablet', '550 mg', 'tablet', 18.5, 0, 40],
  ['Amoxicillin', 'Amoxil', 'Antibiotics', 'Capsule', '500 mg', 'capsule', 14, 1, 60],
  ['Co-Amoxiclav', 'Augmentin', 'Antibiotics', 'Tablet', '625 mg', 'tablet', 68, 1, 30],
  ['Cefalexin', 'Generic', 'Antibiotics', 'Capsule', '500 mg', 'capsule', 11.5, 1, 40],
  ['Azithromycin', 'Zithromax', 'Antibiotics', 'Tablet', '500 mg', 'tablet', 95, 1, 20],
  ['Ciprofloxacin', 'Generic', 'Antibiotics', 'Tablet', '500 mg', 'tablet', 16, 1, 30],
  ['Cetirizine', 'Virlix', 'Antihistamines', 'Tablet', '10 mg', 'tablet', 22, 0, 40],
  ['Loratadine', 'Claritin', 'Antihistamines', 'Tablet', '10 mg', 'tablet', 28, 0, 40],
  ['Diphenhydramine', 'Benadryl', 'Antihistamines', 'Capsule', '50 mg', 'capsule', 13, 0, 30],
  ['Amlodipine', 'Norvasc', 'Antihypertensives', 'Tablet', '5 mg', 'tablet', 24, 1, 60],
  ['Losartan', 'Cozaar', 'Antihypertensives', 'Tablet', '50 mg', 'tablet', 32, 1, 60],
  ['Metoprolol', 'Generic', 'Antihypertensives', 'Tablet', '50 mg', 'tablet', 8.5, 1, 40],
  ['Metformin', 'Glucophage', 'Antidiabetics', 'Tablet', '500 mg', 'tablet', 7.25, 1, 80],
  ['Gliclazide', 'Diamicron', 'Antidiabetics', 'Tablet', '30 mg', 'tablet', 19, 1, 30],
  ['Carbocisteine', 'Solmux', 'Cough and Cold', 'Capsule', '500 mg', 'capsule', 9, 0, 60],
  ['Ambroxol', 'Mucosolvan', 'Cough and Cold', 'Syrup', '15 mg/5 mL', 'bottle', 168, 0, 10],
  ['Phenylephrine + Paracetamol', 'Neozep', 'Cough and Cold', 'Tablet', '10 mg/500 mg', 'tablet', 6.5, 0, 100],
  ['Guaifenesin', 'Robitussin', 'Cough and Cold', 'Syrup', '100 mg/5 mL', 'bottle', 189, 0, 10],
  ['Loperamide', 'Diatabs', 'Gastrointestinal', 'Capsule', '2 mg', 'capsule', 8, 0, 40],
  ['Omeprazole', 'Losec', 'Gastrointestinal', 'Capsule', '20 mg', 'capsule', 26, 1, 40],
  ['Aluminum + Magnesium Hydroxide', 'Kremil-S', 'Gastrointestinal', 'Tablet', '178 mg/233 mg', 'tablet', 8.75, 0, 50],
  ['Oral Rehydration Salts', 'Hydrite', 'Gastrointestinal', 'Sachet', '20.5 g', 'sachet', 15, 0, 40],
  ['Ascorbic Acid', 'Ceelin', 'Vitamins and Supplements', 'Syrup', '100 mg/5 mL', 'bottle', 135, 0, 10],
  ['Ascorbic Acid + Zinc', 'Immunpro', 'Vitamins and Supplements', 'Tablet', '500 mg/10 mg', 'tablet', 9.5, 0, 80],
  ['Multivitamins + Iron', 'Enervon', 'Vitamins and Supplements', 'Tablet', '1 tablet', 'tablet', 7.5, 0, 60],
  ['Vitamin B Complex', 'Neurobion', 'Vitamins and Supplements', 'Tablet', '100 mg/200 mg/200 mcg', 'tablet', 34, 0, 40],
  ['Ferrous Sulfate', 'Generic', 'Vitamins and Supplements', 'Tablet', '325 mg', 'tablet', 4, 0, 50],
  ['Atorvastatin', 'Lipitor', 'Cholesterol', 'Tablet', '20 mg', 'tablet', 48, 1, 40],
  ['Simvastatin', 'Generic', 'Cholesterol', 'Tablet', '20 mg', 'tablet', 12, 1, 30],
  ['Salbutamol', 'Ventolin', 'Respiratory', 'Inhaler', '100 mcg/dose', 'inhaler', 420, 1, 5],
  ['Salbutamol', 'Generic', 'Respiratory', 'Nebule', '2.5 mg/2.5 mL', 'nebule', 22, 1, 30],
  ['Montelukast', 'Singulair', 'Respiratory', 'Tablet', '10 mg', 'tablet', 55, 1, 20],
  ['Povidone-Iodine', 'Betadine', 'First Aid', 'Solution', '10%', 'bottle', 98, 0, 10],
  ['Isopropyl Alcohol', 'Generic', 'First Aid', 'Solution', '70%', 'bottle', 75, 0, 15],
  ['Hydrogen Peroxide', 'Agua Oxinada', 'First Aid', 'Solution', '3%', 'bottle', 42, 0, 10],
  ['Mupirocin', 'Bactroban', 'First Aid', 'Ointment', '2%', 'tube', 310, 1, 5],
];
const medicines = medicineRows.map(([generic_name, brand, c, dosage_form, strength, unit, price, rx, reorder], i) => ({
  medicine_id: i + 1, generic_name, brand, category: c, dosage_form, strength, unit, price,
  requires_prescription: rx, reorder_level: reorder, barcode: `48000000${String(i + 1).padStart(5, '0')}`, is_active: 1,
}));
const medById = Object.fromEntries(medicines.map((m) => [m.medicine_id, m]));

// Demo states per branch: near expiry, expired, low stock, out of stock.
const nearExpiry = new Set(['1:3', '1:11', '2:19', '1:27', '2:4']);
const expired = new Set(['1:13', '2:26', '1:38']);
const lowStock = new Set(['1:7', '1:34', '2:15', '2:9', '1:20']);
const outOfStock = new Set(['2:36']);

const batches = [];
const movements = [];
let batchId = 0;
let movementId = 0;
const RECEIVED_DAYS_AGO = 60;
const managerOf = { 1: 2, 2: 5 };

for (const branch of branches) {
  for (const med of medicines) {
    const key = `${branch.branch_id}:${med.medicine_id}`;
    if (outOfStock.has(key)) continue;
    const isBottle = ['bottle', 'inhaler', 'tube'].includes(med.unit);
    const plans = [];
    if (expired.has(key)) plans.push({ expiry: -int(5, 40), qty: isBottle ? int(6, 10) : int(60, 90) });
    if (nearExpiry.has(key)) plans.push({ expiry: int(18, 75), qty: isBottle ? int(30, 40) : int(260, 340) });
    if (lowStock.has(key)) plans.push({ expiry: int(240, 600), qty: isBottle ? int(3, 5) : int(med.reorder_level, med.reorder_level + 25) });
    else plans.push({ expiry: int(180, 720), qty: isBottle ? int(25, 45) : int(220, 420) });
    if (!lowStock.has(key) && rand() < 0.35) plans.push({ expiry: int(400, 900), qty: isBottle ? int(15, 30) : int(150, 300) });

    plans.forEach((p, idx) => {
      batchId += 1;
      const b = {
        batch_id: batchId, medicine_id: med.medicine_id, branch_id: branch.branch_id,
        supplier: suppliers[(med.medicine_id + idx) % 3],
        batch_no: `${branch.code}${String(med.medicine_id).padStart(3, '0')}-${String.fromCharCode(65 + idx)}${int(100, 999)}`,
        expiryOffset: p.expiry, cost_price: Math.round(med.price * 0.68 * 100) / 100,
        qty_on_hand: p.qty,
      };
      batches.push(b);
      movements.push({
        movement_id: ++movementId, batch_id: b.batch_id, user_id: managerOf[branch.branch_id],
        type: 'receive', qty_change: p.qty, ref_type: 'batch', ref_id: b.batch_id, reason: 'Initial stock (sample data)',
        created_at: momentExpr(RECEIVED_DAYS_AGO, 540),
      });
    });
  }
}

// Allocate first-expiry-first-out from batches still valid on the sale date.
const allocate = (branchId, medicineId, qty, daysAgo) => {
  const usable = batches
    .filter((b) => b.branch_id === branchId && b.medicine_id === medicineId && b.qty_on_hand > 0 && b.expiryOffset > -daysAgo)
    .sort((a, b) => a.expiryOffset - b.expiryOffset);
  const available = usable.reduce((s, b) => s + b.qty_on_hand, 0);
  if (available < qty) return null;
  const parts = [];
  let remaining = qty;
  for (const b of usable) {
    if (!remaining) break;
    const take = Math.min(b.qty_on_hand, remaining);
    parts.push({ batch: b, take });
    remaining -= take;
  }
  return parts;
};

const prescriptions = [];
const prescribedItems = [];
const sales = [];
const saleItems = [];
let rxId = 0;
let rxItemId = 0;
let saleId = 0;
let saleItemId = 0;

const rxMeds = medicines.filter((m) => m.requires_prescription).map((m) => m.medicine_id);
const otcMeds = medicines.filter((m) => !m.requires_prescription).map((m) => m.medicine_id);
const doctors = [['Dr. Lara Velasco', 'PRC-MD-SAMPLE-11'], ['Dr. Miguel Tan', 'PRC-MD-SAMPLE-12'], ['Dr. Nina Robles', 'PRC-MD-SAMPLE-13']];
const staffOf = { 1: { cashier: 4, pharmacist: 3 }, 2: { cashier: 7, pharmacist: 6 } };

const recordSale = ({ branchId, daysAgo, minute, customer, rx, lines, cashierId }) => {
  saleId += 1;
  const discountType = customer && customer.discount_id_type !== 'none' && rand() < 0.85 ? customer.discount_id_type : 'none';
  const allocated = [];
  for (const line of lines) {
    const parts = allocate(branchId, line.medicine_id, line.quantity, daysAgo);
    if (!parts) continue;
    parts.forEach(({ batch, take }) => allocated.push({ line, batch, take }));
  }
  if (!allocated.length) { saleId -= 1; return null; }

  const totals = computeTotals(allocated.map((a) => ({ unit_price: medById[a.line.medicine_id].price, quantity: a.take })), discountType);
  const method = rand() < 0.7 ? 'cash' : rand() < 0.66 ? 'gcash' : 'card';
  const tendered = method === 'cash' ? Math.ceil(totals.total / 50) * 50 + (rand() < 0.3 ? 50 : 0) : totals.total;
  const createdAt = momentExpr(daysAgo, minute);

  sales.push({
    sale_id: saleId, receipt_no: receiptNo(branchId, saleId), branch_id: branchId,
    cashier_id: cashierId, customer_id: customer?.customer_id ?? null, prescription_id: rx?.prescription_id ?? null,
    ...totals, discount_type: discountType, discount_id_no: discountType === 'none' ? null : customer.discount_id_no,
    payment_method: method, amount_tendered: tendered,
    payment_ref: method === 'cash' ? null : `REF${String(100000 + saleId)}`, status: 'completed', created_at: createdAt,
  });
  for (const { line, batch, take } of allocated) {
    batch.qty_on_hand -= take;
    const price = medById[line.medicine_id].price;
    saleItems.push({ sale_item_id: ++saleItemId, sale_id: saleId, medicine_id: line.medicine_id, batch_id: batch.batch_id, quantity: take, unit_price: price, line_total: lineTotal(price, take) });
    movements.push({ movement_id: ++movementId, batch_id: batch.batch_id, user_id: cashierId, type: 'sale', qty_change: -take, ref_type: 'sale', ref_id: saleId, reason: null, created_at: createdAt });
  }
  return { saleId, allocated };
};

const newPrescription = ({ branchId, customer, daysAgo, status, items }) => {
  const [doctor, license] = pick(doctors);
  const staff = staffOf[branchId];
  const reviewed = status !== 'pending';
  const rx = {
    prescription_id: ++rxId, customer_id: customer.customer_id, branch_id: branchId,
    reviewed_by: reviewed ? staff.pharmacist : null, doctor_name: doctor, doctor_license_no: license,
    date_issued: dayExpr(-daysAgo - int(0, 3)), notes: 'Sample prescription',
    status, rejection_reason: status === 'rejected' ? 'Prescription is unsigned. Ask the patient for a signed copy.' : null,
    reviewed_at: reviewed ? momentExpr(daysAgo, 600) : null, created_by: staff.pharmacist, created_at: momentExpr(daysAgo, 590),
  };
  prescriptions.push(rx);
  for (const it of items) {
    prescribedItems.push({ item_id: ++rxItemId, prescription_id: rx.prescription_id, medicine_id: it.medicine_id, quantity: it.quantity, qty_dispensed: it.dispensed ?? 0, instructions: it.instructions });
  }
  return rx;
};

const instructions = ['1 tablet every 8 hours for 7 days', '1 tablet once daily after breakfast', '1 capsule twice a day', '1 tablet at bedtime'];

for (let daysAgo = SALE_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
  for (const branch of branches) {
    const staff = staffOf[branch.branch_id];
    const count = daysAgo === 0 ? int(4, 7) : int(branch.branch_id === 1 ? 8 : 5, branch.branch_id === 1 ? 14 : 10);
    const minutes = Array.from({ length: count }, () => (daysAgo === 0 ? int(5, 420) : int(480, 1260))).sort((a, b) => a - b);
    for (const minute of minutes) {
      const customer = rand() < 0.35 ? pick(customers) : null;
      const lines = Array.from({ length: int(1, 3) }, () => ({ medicine_id: pick(otcMeds), quantity: int(1, 6) }))
        .filter((l, i, arr) => arr.findIndex((x) => x.medicine_id === l.medicine_id) === i)
        .map((l) => (['bottle', 'inhaler', 'tube'].includes(medById[l.medicine_id].unit) ? { ...l, quantity: 1 } : l));
      recordSale({ branchId: branch.branch_id, daysAgo, minute, customer, lines, cashierId: rand() < 0.8 ? staff.cashier : staff.pharmacist });
    }

    if (daysAgo % 3 === 0) {
      const customer = pick(customers);
      const items = [{ medicine_id: pick(rxMeds), quantity: int(7, 21), instructions: pick(instructions) }];
      if (rand() < 0.4) {
        const second = pick(rxMeds);
        if (second !== items[0].medicine_id) items.push({ medicine_id: second, quantity: int(7, 14), instructions: pick(instructions) });
      }
      const canFill = items.every((it) => {
        const avail = batches.filter((b) => b.branch_id === branch.branch_id && b.medicine_id === it.medicine_id && b.expiryOffset > -daysAgo)
          .reduce((s, b) => s + b.qty_on_hand, 0);
        return avail >= it.quantity;
      });
      if (!canFill) continue;
      const rx = newPrescription({ branchId: branch.branch_id, customer, daysAgo, status: 'dispensed', items: items.map((it) => ({ ...it, dispensed: it.quantity })) });
      recordSale({ branchId: branch.branch_id, daysAgo, minute: 720, customer, rx, lines: items, cashierId: staff.pharmacist });
    }
  }
}

// Open prescriptions for the live demo: some awaiting review, some verified and ready at the POS, one rejected.
newPrescription({ branchId: 1, customer: customers[0], daysAgo: 0, status: 'pending', items: [{ medicine_id: 15, quantity: 30, instructions: '1 tablet once daily' }, { medicine_id: 32, quantity: 30, instructions: '1 tablet at bedtime' }] });
newPrescription({ branchId: 1, customer: customers[3], daysAgo: 0, status: 'pending', items: [{ medicine_id: 6, quantity: 21, instructions: '1 capsule every 8 hours for 7 days' }] });
newPrescription({ branchId: 1, customer: customers[4], daysAgo: 1, status: 'verified', items: [{ medicine_id: 17, quantity: 60, instructions: '1 tablet twice a day with meals' }] });
newPrescription({ branchId: 1, customer: customers[1], daysAgo: 1, status: 'verified', items: [{ medicine_id: 14, quantity: 30, instructions: '1 tablet once daily' }, { medicine_id: 24, quantity: 14, instructions: '1 capsule before breakfast' }] });
newPrescription({ branchId: 1, customer: customers[7], daysAgo: 2, status: 'rejected', items: [{ medicine_id: 9, quantity: 3, instructions: '1 tablet once daily for 3 days' }] });
newPrescription({ branchId: 2, customer: customers[9], daysAgo: 0, status: 'pending', items: [{ medicine_id: 7, quantity: 14, instructions: '1 tablet every 12 hours' }] });
newPrescription({ branchId: 2, customer: customers[13], daysAgo: 1, status: 'verified', items: [{ medicine_id: 16, quantity: 30, instructions: '1 tablet once daily' }] });

// Main Branch sent loratadine to North Branch: two lines in stock history, one per branch.
{
  const daysAgo = 10;
  const medicineId = 12;
  const parts = allocate(1, medicineId, 40, daysAgo);
  for (const { batch, take } of parts) {
    batch.qty_on_hand -= take;
    batchId += 1;
    const dest = { ...batch, batch_id: batchId, branch_id: 2, qty_on_hand: take };
    batches.push(dest);
    movements.push({ movement_id: ++movementId, batch_id: batch.batch_id, user_id: 2, type: 'transfer_out', qty_change: -take, ref_type: 'branch', ref_id: 2, reason: 'Sent to North Branch: ran low on loratadine', created_at: momentExpr(daysAgo, 600) });
    movements.push({ movement_id: ++movementId, batch_id: dest.batch_id, user_id: 2, type: 'transfer_in', qty_change: take, ref_type: 'branch', ref_id: 1, reason: 'From Main Branch', created_at: momentExpr(daysAgo, 600) });
  }
}

// A damaged-stock adjustment so the ledger shows more than receipts and sales.
{
  const b = batches.find((x) => x.branch_id === 1 && x.medicine_id === 2 && x.qty_on_hand > 2);
  b.qty_on_hand -= 2;
  movements.push({ movement_id: ++movementId, batch_id: b.batch_id, user_id: 2, type: 'adjust', qty_change: -2, ref_type: 'batch', ref_id: b.batch_id, reason: 'Damaged: bottles cracked in storage', created_at: momentExpr(5, 610) });
}

out.push('-- Sample data for the Pharmacy Management System. Generated by scripts/generate-seed.js; do not edit by hand.');
out.push(`-- All people, companies, addresses and license numbers are fictional. Demo password for every account: ${DEMO_PASSWORD}\n`);
out.push('SET FOREIGN_KEY_CHECKS = 0;\n');
insert('tbl_branches', branches.map(({ code: _code, ...b }) => ({ ...b, is_active: 1 })));
insert('tbl_users', users);
insert('tbl_customers', customers);
insert('tbl_medicines', medicines);
insert('tbl_batches', batches.map(({ expiryOffset, ...b }) => ({ ...b, expiry_date: dayExpr(expiryOffset), received_at: momentExpr(RECEIVED_DAYS_AGO, 540) })));
insert('tbl_prescription', prescriptions);
insert('tbl_prescribed_items', prescribedItems);
insert('tbl_sales', sales);
insert('tbl_sale_items', saleItems);
insert('tbl_stock_movements', movements);
out.push('SET FOREIGN_KEY_CHECKS = 1;');

writeFileSync(new URL('../database/seed.sql', import.meta.url), out.join('\n'));
console.log(`seed.sql written: ${batches.length} batches, ${sales.length} sales, ${prescriptions.length} prescriptions, ${movements.length} movements`);
