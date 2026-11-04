// Writes docs/pharmacy.postman_collection.json from a compact endpoint list.
// Import it into Postman, run "Sign in" first, and the session cookie is reused for the other requests.
import { writeFileSync } from 'node:fs';

const groups = {
  Auth: [
    ['Sign in', 'POST', 'auth/login', { username: 'manager.main', password: 'Pharmacy123!' }],
    ['Current user', 'GET', 'auth/me'],
    ['Sign out', 'POST', 'auth/logout'],
  ],
  Medicines: [
    ['List (search, filter)', 'GET', 'medicines?q=para&rx=otc&stock=in&page=1&limit=25'],
    ['Get one', 'GET', 'medicines/1'],
    ['Create', 'POST', 'medicines', { generic_name: 'Cetirizine', brand: 'Demo Brand', category: 'Antihistamines', dosage_form: 'Tablet', strength: '10 mg', unit: 'tablet', price: 18.5, requires_prescription: false, reorder_level: 20, barcode: '4809999999999' }],
    ['Update', 'PUT', 'medicines/1', { generic_name: 'Paracetamol', brand: 'Biogesic', category: 'Analgesics', dosage_form: 'Tablet', strength: '500 mg', unit: 'tablet', price: 5.75, requires_prescription: false, reorder_level: 100, barcode: '4800000000001' }],
    ['Archive', 'DELETE', 'medicines/41'],
    ['Validation error (400)', 'POST', 'medicines', { generic_name: '', price: -1 }],
  ],
  Customers: [
    ['List', 'GET', 'customers?q=aquino'],
    ['Create', 'POST', 'customers', { firstname: 'Juan', lastname: 'Dela Cruz', phone: '09171234567', discount_id_type: 'senior', discount_id_no: 'SC-DEMO-1' }],
    ['History', 'GET', 'customers/1/history'],
  ],
  Inventory: [
    ['Batches', 'GET', 'batches?in_stock=true&sort=expiry_date'],
    ['Receive stock', 'POST', 'batches', { medicine_id: 1, supplier: 'Sample Pharma Distributors', batch_no: 'DEMO-001', expiry_date: '2028-12-31', cost_price: 3.5, quantity: 100 }],
    ['Remove expired stock', 'POST', 'batches/1/adjust', { type: 'write_off', qty_change: -1, reason: 'Expired' }],
    ['Count correction (manager)', 'POST', 'batches/1/adjust', { type: 'adjust', qty_change: -1, reason: 'Shelf count is different' }],
    ['Alerts', 'GET', 'inventory/alerts'],
    ['Reorder suggestions', 'GET', 'inventory/reorder'],
    ['Stock history for one medicine', 'GET', 'inventory/movements?medicine=1'],
  ],
  Prescriptions: [
    ['List ready to dispense', 'GET', 'prescriptions?status=dispensable'],
    ['Create', 'POST', 'prescriptions', { customer_id: 3, doctor_name: 'Dr. Demo', doctor_license_no: 'MD-DEMO-1', date_issued: '2026-11-01', items: [{ medicine_id: 6, quantity: 21, instructions: '1 capsule every 8 hours' }] }],
    ['Save and verify in one step (sign in as pharmacist.main)', 'POST', 'prescriptions', { customer_id: 3, doctor_name: 'Dr. Demo', doctor_license_no: 'MD-DEMO-2', date_issued: '2026-11-01', verify: true, items: [{ medicine_id: 6, quantity: 21 }] }],
    ['Verify (sign in as pharmacist.main)', 'POST', 'prescriptions/20/verify'],
    ['Printable record', 'GET', 'prescriptions/20'],
    ['Reject (sign in as pharmacist.main)', 'POST', 'prescriptions/21/reject', { reason: 'Unsigned prescription' }],
  ],
  Sales: [
    ['Checkout (cash)', 'POST', 'sales', { items: [{ medicine_id: 1, quantity: 10 }], discount_type: 'none', payment_method: 'cash', amount_tendered: 100 }],
    ['Checkout (Rx, senior)', 'POST', 'sales', { items: [{ medicine_id: 14, quantity: 30 }], prescription_id: 23, customer_id: 2, discount_type: 'senior', payment_method: 'gcash', payment_ref: 'GC123456' }],
    ['Insufficient stock (409)', 'POST', 'sales', { items: [{ medicine_id: 1, quantity: 99999 }], payment_method: 'card', payment_ref: 'X' }],
    ['List', 'GET', 'sales?from=2026-11-01&to=2026-11-30'],
    ['Receipt', 'GET', 'sales/1'],
    ['Void (manager)', 'POST', 'sales/1/void', { reason: 'Customer returned unopened item' }],
  ],
  Transfers: [
    ['Send stock to another branch (one step)', 'POST', 'transfers', { to_branch_id: 2, items: [{ medicine_id: 1, quantity: 20 }], notes: 'North Branch ran low' }],
  ],
  Reports: [
    ['Dashboard', 'GET', 'dashboard'],
    ['Sales summary', 'GET', 'reports/daily-sales?from=2026-10-01&to=2026-11-30'],
    ['Best-selling medicines', 'GET', 'reports/sales-by-medicine?from=2026-10-01&to=2026-11-30'],
    ['Stock and expiry CSV', 'GET', 'reports/stock-status?format=csv'],
  ],
};

const item = ([name, method, path, body]) => {
  const [p, q] = path.split('?');
  return {
    name,
    request: {
      method,
      header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: {
        raw: `{{baseUrl}}/${path}`, host: ['{{baseUrl}}'], path: p.split('/'),
        ...(q && { query: q.split('&').map((kv) => { const [key, value] = kv.split('='); return { key, value }; }) }),
      },
      ...(body && { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } }),
    },
  };
};

const collection = {
  info: { name: 'Pharmacy Management System API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Run "Auth / Sign in" first. Postman keeps the session cookie for the other requests. IDs match the seeded demo data.' },
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000/api' }],
  item: Object.entries(groups).map(([name, items]) => ({ name, item: items.map(item) })),
};
writeFileSync(new URL('../docs/pharmacy.postman_collection.json', import.meta.url), `${JSON.stringify(collection, null, 2)}\n`);
console.log('Postman collection written.');
