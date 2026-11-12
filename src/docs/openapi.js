// OpenAPI 3 description of the REST API, shown by Swagger UI at /api-docs.
// Each entry is compact: [method, path, tag, summary, roles, options]. Options can hold query params,
// an example request body, and notes. Keep this in step with src/routes/index.js.

const ROLE_NOTE = {
  any: 'Any signed-in user.',
  public: 'No sign-in needed.',
  owner: 'Owner only (a manager with no branch).',
  manager: 'Managers (including the owner).',
  stock: 'Managers and pharmacists.',
  pharmacist: 'Pharmacists only (with a current PRC license on file).',
  seller: 'Anyone with a branch (the owner has no till).',
};

const q = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema });
const page = [q('page', 'Page number', { type: 'integer', minimum: 1 }), q('limit', 'Rows per page (max 200)', { type: 'integer', minimum: 1, maximum: 200 })];
const branch = q('branch', 'Branch ID. Only the owner can choose; everyone else always sees their own branch.', { type: 'integer' });
const status = q('status', 'active, inactive, or all', { type: 'string', enum: ['active', 'inactive', 'all'] });

const ENDPOINTS = [
  ['post', '/auth/login', 'Auth', 'Sign in', 'public', { body: { username: 'manager.main', password: 'Pharmacy123!' }, notes: 'Sets the session cookie used by every other request. Rate limited.' }],
  ['post', '/auth/logout', 'Auth', 'Sign out', 'any'],
  ['get', '/auth/me', 'Auth', 'Current user', 'any'],
  ['patch', '/auth/me/password', 'Auth', 'Change your password', 'any', { body: { current_password: 'Pharmacy123!', new_password: 'NewPassw0rd' } }],

  ['get', '/branches', 'Branches', 'List branches', 'any', { query: [q('status', 'Owner only: all to include inactive')] }],
  ['get', '/branches/{id}', 'Branches', 'Get a branch', 'any'],
  ['post', '/branches', 'Branches', 'Add a branch', 'owner', { body: { name: 'South Branch', address: '5 Luna Street', phone: '0430000303' } }],
  ['put', '/branches/{id}', 'Branches', 'Update a branch', 'owner', { body: { name: 'South Branch', address: '5 Luna Street', phone: '0430000303', is_active: true } }],
  ['delete', '/branches/{id}', 'Branches', 'Deactivate a branch', 'owner', { notes: '409 while the branch still has active staff.' }],

  ['get', '/users', 'Staff accounts', 'List staff', 'manager', { query: [q('q', 'Name, username or license no.'), q('role', 'manager, pharmacist or cashier'), branch, status, ...page] }],
  ['get', '/users/{id}', 'Staff accounts', 'Get a staff account', 'manager'],
  ['post', '/users', 'Staff accounts', 'Add a staff account', 'owner', {
    body: { username: 'new.pharm', full_name: 'New Pharmacist', role: 'pharmacist', branch_id: 1, license_no: 'PRC-NEW-1', license_expiry: '2030-01-01', password: 'TempPass123' },
    notes: 'branch_id is required unless the role is manager (no branch = owner). Pharmacists need license_no and license_expiry.',
  }],
  ['put', '/users/{id}', 'Staff accounts', 'Update a staff account', 'owner', { body: { username: 'cashier.main', full_name: 'Dana Cruz', role: 'cashier', branch_id: 1, is_active: true }, notes: 'password is optional and resets it when given.' }],
  ['delete', '/users/{id}', 'Staff accounts', 'Deactivate a staff account', 'owner'],

  ['get', '/customers', 'Customers', 'List customers', 'any', { query: [q('q', 'Name, phone or ID no.'), q('discount', 'none, senior or pwd'), status, ...page] }],
  ['get', '/customers/{id}', 'Customers', 'Get a customer', 'any'],
  ['get', '/customers/{id}/history', 'Customers', 'Purchases and prescriptions', 'any'],
  ['post', '/customers', 'Customers', 'Add a customer', 'any', { body: { firstname: 'Juan', lastname: 'Dela Cruz', phone: '09171234567', discount_id_type: 'senior', discount_id_no: 'SC-DEMO-1' } }],
  ['put', '/customers/{id}', 'Customers', 'Update a customer', 'any', { body: { firstname: 'Juan', lastname: 'Dela Cruz', phone: '09171234567', discount_id_type: 'none', is_active: true } }],
  ['delete', '/customers/{id}', 'Customers', 'Archive a customer', 'stock'],

  ['get', '/categories', 'Medicines', 'Category suggestions', 'any', { notes: 'Categories are free text on medicines; this lists the ones in use.' }],
  ['get', '/suppliers', 'Stock', 'Supplier suggestions', 'any', { notes: 'Suppliers are free text on lots; this lists the ones in use.' }],
  ['get', '/medicines', 'Medicines', 'List medicines with stock', 'any', {
    query: [q('q', 'Name, brand or exact barcode'), q('category', 'Category name'), q('rx', 'rx or otc'), q('stock', 'in, low, out, expiring or expired'), status, branch,
      q('sort', 'generic_name, brand, price, stock_on_hand, nearest_expiry'), q('dir', 'asc or desc'), ...page],
  }],
  ['get', '/medicines/{id}', 'Medicines', 'Get a medicine with stock per branch', 'any'],
  ['get', '/medicines/barcode/{code}', 'Medicines', 'Find by barcode', 'any'],
  ['post', '/medicines', 'Medicines', 'Add a medicine', 'manager', {
    body: { generic_name: 'Lagundi', brand: 'Ascof', category: 'Herbal', dosage_form: 'Tablet', strength: '600 mg', unit: 'tablet', price: 9.5, requires_prescription: false, reorder_level: 20, barcode: null },
  }],
  ['put', '/medicines/{id}', 'Medicines', 'Update a medicine', 'manager', {
    body: { generic_name: 'Paracetamol', brand: 'Biogesic', category: 'Analgesics', dosage_form: 'Tablet', strength: '500 mg', unit: 'tablet', price: 5.75, requires_prescription: false, reorder_level: 100, barcode: '4800000000001', is_active: true },
  }],
  ['delete', '/medicines/{id}', 'Medicines', 'Archive a medicine', 'manager'],

  ['get', '/batches', 'Stock', 'List lots', 'any', { query: [q('q', 'Medicine or lot no.'), q('medicine', 'Medicine ID', { type: 'integer' }), branch, q('expiry', 'expired, near or ok'), q('in_stock', 'true to hide empty lots'), ...page] }],
  ['get', '/batches/{id}', 'Stock', 'Get a lot', 'any'],
  ['post', '/batches', 'Stock', 'Receive a delivery', 'stock', {
    body: { medicine_id: 1, quantity: 100, expiry_date: '2028-12-31', batch_no: 'DEMO-001', supplier: 'Sample Pharma Distributors', cost_price: 3.5 },
    notes: 'supplier and cost_price are optional. The owner must also send branch_id. If the lot number is already on file at this branch with the same expiry, the units are added to it (200). With a different expiry the delivery is refused (409).',
  }],
  ['patch', '/batches/{id}', 'Stock', 'Fix lot details', 'manager', {
    body: { batch_no: 'DEMO-001', expiry_date: '2028-12-31', cost_price: 3.5, supplier: 'Sample Pharma Distributors' },
    notes: 'A new expiry date must be in the future. An expired lot cannot be re-dated, and once units from a lot are sold its expiry can only move earlier (409).',
  }],
  ['post', '/batches/{id}/adjust', 'Stock', 'Remove stock or correct a count', 'stock', {
    body: { type: 'write_off', qty_change: -5, reason: 'Expired' },
    notes: 'write_off removes expired or damaged stock (negative qty_change). adjust is a count correction (signed) and needs a manager.',
  }],
  ['get', '/inventory/alerts', 'Stock', 'Expired, expiring and low stock', 'any', { query: [branch] }],
  ['get', '/inventory/reorder', 'Stock', 'Suggested order quantities', 'stock', { query: [branch] }],
  ['get', '/inventory/movements', 'Stock', 'Stock history', 'stock', { query: [q('medicine', 'Medicine ID', { type: 'integer' }), q('batch', 'Lot ID', { type: 'integer' }), q('type', 'receive, sale, adjust, transfer_out, transfer_in, void_return, write_off'), q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD'), branch, ...page] }],
  ['post', '/transfers', 'Stock', 'Send stock to another branch', 'manager', {
    body: { to_branch_id: 2, items: [{ medicine_id: 1, quantity: 20 }], notes: 'North Branch ran low' },
    notes: 'One step: stock leaves this branch (earliest expiry first) and arrives at the other with the same lot number and expiry. The owner must also send from_branch_id.',
  }],

  ['get', '/prescriptions', 'Prescriptions', 'List prescriptions', 'any', { query: [q('q', 'Patient, doctor or number'), q('status', 'pending, verified, partially_dispensed, dispensed, rejected or dispensable'), q('customer', 'Customer ID', { type: 'integer' }), branch, ...page] }],
  ['get', '/prescriptions/{id}', 'Prescriptions', 'Get a prescription (printable record)', 'any'],
  ['post', '/prescriptions', 'Prescriptions', 'Record a prescription', 'any', {
    body: { customer_id: 3, doctor_name: 'Dr. Demo', doctor_license_no: 'MD-DEMO-1', date_issued: '2026-11-01', verify: false, items: [{ medicine_id: 6, quantity: 21, instructions: '1 capsule every 8 hours' }] },
    notes: 'With verify: true a pharmacist saves and verifies in one step. Prescriptions are valid for 180 days from date_issued: older ones can be recorded and rejected, but not verified or given out (409).',
  }],
  ['put', '/prescriptions/{id}', 'Prescriptions', 'Edit a pending prescription', 'any', { body: { customer_id: 3, doctor_name: 'Dr. Demo', doctor_license_no: 'MD-DEMO-1', date_issued: '2026-11-01', items: [{ medicine_id: 6, quantity: 21 }] } }],
  ['delete', '/prescriptions/{id}', 'Prescriptions', 'Delete a pending prescription', 'any'],
  ['post', '/prescriptions/{id}/verify', 'Prescriptions', 'Verify', 'pharmacist'],
  ['post', '/prescriptions/{id}/reject', 'Prescriptions', 'Reject', 'pharmacist', { body: { reason: 'Unsigned prescription' } }],

  ['get', '/sales', 'Sales', 'List sales', 'any', { query: [q('q', 'Receipt no. or customer'), q('status', 'completed or voided'), q('payment', 'cash, gcash or card'), q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD'), branch, ...page] }],
  ['get', '/sales/{id}', 'Sales', 'Get a receipt', 'any'],
  ['post', '/sales', 'Sales', 'Checkout', 'seller', {
    body: { items: [{ medicine_id: 1, quantity: 10 }], discount_type: 'none', payment_method: 'cash', amount_tendered: 100 },
    notes: 'Rx medicines need a verified prescription_id. Totals are computed on the server. Stock is taken earliest expiry first. Any failure saves nothing.',
  }],
  ['post', '/sales/{id}/void', 'Sales', 'Void a sale', 'manager', { body: { reason: 'Customer returned unopened item' } }],

  ['get', '/dashboard', 'Home and reports', 'Home page figures', 'any', { query: [branch] }],
  ['get', '/reports/{name}', 'Home and reports', 'Run a report', 'manager', {
    query: [q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD'), branch, q('format', 'json or csv')],
    notes: 'name: daily-sales (Sales summary), sales-by-medicine (Best-selling medicines), or stock-status (Stock and expiry).',
  }],
  ['get', '/notifications', 'Home and reports', 'Notifications for the signed-in user', 'any', {
    query: [branch],
    notes: 'Built from existing data for this person\'s role: prescriptions to check, prescriptions they recorded that were checked, voided sales, stock problems and PRC licenses. meta.counts holds the sidebar counts. Read/unread is tracked by the browser.',
  }],
  ['get', '/cash/summary', 'Home and reports', 'End-of-day cash summary', 'any', {
    query: [q('cashier', 'Staff member ID (defaults to you; required for the owner)', { type: 'integer' }), q('date', 'YYYY-MM-DD (defaults to today; past days are for managers)')],
    notes: 'Totals by payment method for one person\'s sales on one day, used to count the cash drawer. Staff see their own day; a branch manager sees anyone at the branch; the owner sees anyone. The count itself is printed, not stored.',
  }],
];

function operation([method, path, tag, summary, roles, opts = {}]) {
  const params = [...(path.match(/\{(\w+)\}/g) ?? []).map((m) => {
    const name = m.slice(1, -1);
    return { name, in: 'path', required: true, schema: name === 'id' ? { type: 'integer' } : { type: 'string' } };
  }), ...(opts.query ?? [])];
  const op = {
    tags: [tag],
    summary,
    description: [ROLE_NOTE[roles], opts.notes].filter(Boolean).join('\n\n'),
    ...(roles === 'public' ? { security: [] } : {}),
    ...(params.length ? { parameters: params } : {}),
    ...(opts.body ? { requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' }, example: opts.body } } } } : {}),
    responses: {
      [method === 'post' && !path.includes('/auth/') && !/\/(verify|reject|void|adjust)$/.test(path) ? 201 : 200]: { $ref: '#/components/responses/Ok' },
      400: { $ref: '#/components/responses/Error' },
      ...(roles === 'public' ? {} : { 401: { $ref: '#/components/responses/Error' }, 403: { $ref: '#/components/responses/Error' } }),
      ...(path.includes('{') ? { 404: { $ref: '#/components/responses/Error' } } : {}),
      ...(method !== 'get' ? { 409: { $ref: '#/components/responses/Error' } } : {}),
    },
  };
  return op;
}

const paths = {};
for (const e of ENDPOINTS) {
  paths[e[1]] ??= {};
  paths[e[1]][e[0]] = operation(e);
}

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Pharmacy Management System API',
    version: '2.0.0',
    description: [
      'REST API for selling, stock and expiry tracking, prescriptions, and reports.',
      '**To try requests here:** open **Auth → Sign in**, click *Try it out*, then *Execute* with a demo account',
      '(password `Pharmacy123!`). The browser keeps the session cookie, so every other request runs as that user.',
      'Demo accounts: `manager` (owner), `manager.main`, `pharmacist.main`, `cashier.main`.',
    ].join(' '),
  },
  servers: [{ url: '/api' }],
  tags: ['Auth', 'Medicines', 'Stock', 'Prescriptions', 'Sales', 'Customers', 'Home and reports', 'Staff accounts', 'Branches'].map((name) => ({ name })),
  components: {
    securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'pms.sid', description: 'Set automatically by Auth → Sign in.' } },
    schemas: {
      Ok: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: {}, meta: { type: 'object' } } },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Some fields need attention.' },
          errors: { type: 'object', additionalProperties: { type: 'string' }, example: { price: 'Price must be greater than zero.' } },
        },
      },
    },
    responses: {
      Ok: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ok' } } } },
      Error: { description: 'Error with a message, and field errors for validation problems', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  },
  security: [{ session: [] }],
  paths,
};
