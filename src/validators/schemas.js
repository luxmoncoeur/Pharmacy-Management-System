import {
  z, requiredText, optionalText, optionalPhone, isoDate, optionalDate, id, optionalId,
  money, qty, bool, listQuery, activeFilter, phToday,
} from './common.js';

export const loginSchema = z.object({
  username: requiredText('Username', 50),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(200),
});

const strongPassword = z.string({ error: 'Password is required.' })
  .min(8, 'Use at least 8 characters.')
  .max(100)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const changePasswordSchema = z.object({
  current_password: z.string({ error: 'Current password is required.' }).min(1, 'Current password is required.'),
  new_password: strongPassword,
});

export const branchSchema = z.object({
  name: requiredText('Branch name', 100),
  address: requiredText('Address', 255),
  phone: optionalPhone,
  is_active: bool.optional(),
});

const role = z.enum(['manager', 'pharmacist', 'cashier'], { error: 'Choose a valid role.' });
const userBase = {
  username: requiredText('Username', 50).regex(/^[a-z0-9._-]+$/i, 'Use letters, numbers, dots, dashes or underscores only.'),
  full_name: requiredText('Full name', 120),
  role,
  branch_id: optionalId('Branch'),
  license_no: optionalText('PRC license number', 30),
  license_expiry: optionalDate('License expiry'),
  is_active: bool.optional(),
};
// A manager with no branch is the owner. Pharmacists and cashiers always work at one branch.
const userRules = (schema) => schema
  .refine((u) => u.role === 'manager' || u.branch_id, { message: 'Choose the branch this person works at.', path: ['branch_id'] })
  .refine((u) => u.role !== 'pharmacist' || u.license_no, { message: 'Enter the pharmacist\'s PRC license number.', path: ['license_no'] })
  .refine((u) => u.role !== 'pharmacist' || u.license_expiry, { message: 'Enter the license expiry date.', path: ['license_expiry'] });
export const userCreateSchema = userRules(z.object({ ...userBase, password: strongPassword }));
export const userUpdateSchema = userRules(z.object({ ...userBase, password: z.preprocess((v) => (v === '' ? undefined : v), strongPassword.optional()) }));
export const userListQuery = listQuery(['username', 'full_name', 'role', 'last_login_at'], {
  role: role.optional(), branch: id().optional(), status: activeFilter,
});

export const customerSchema = z.object({
  firstname: requiredText('First name', 60),
  lastname: requiredText('Last name', 60),
  phone: optionalPhone,
  discount_id_type: z.enum(['none', 'senior', 'pwd']).default('none'),
  discount_id_no: optionalText('ID number', 40),
  is_active: bool.optional(),
}).refine((c) => c.discount_id_type === 'none' || c.discount_id_no, {
  message: 'Enter the Senior Citizen or PWD ID number.', path: ['discount_id_no'],
});
export const customerListQuery = listQuery(['lastname', 'firstname', 'created_at'], {
  status: activeFilter, discount: z.enum(['none', 'senior', 'pwd']).optional(),
});

export const medicineSchema = z.object({
  generic_name: requiredText('Generic name', 120),
  brand: requiredText('Brand', 120),
  category: requiredText('Category', 60),
  dosage_form: requiredText('Dosage form', 40),
  strength: requiredText('Strength', 40),
  unit: requiredText('Unit', 20),
  price: money('Price').refine((n) => n > 0, 'Price must be greater than zero.'),
  requires_prescription: bool.default(false),
  reorder_level: z.coerce.number().int('Reorder level must be a whole number.').min(0, 'Reorder level cannot be negative.').max(100000).default(20),
  barcode: z.preprocess((v) => (v === '' ? null : v), z.string().trim().regex(/^[0-9A-Za-z-]{4,32}$/, 'Barcode must be 4 to 32 letters or digits.').nullable().optional()),
  is_active: bool.optional(),
});
export const medicineListQuery = listQuery(['generic_name', 'brand', 'price', 'stock_on_hand', 'nearest_expiry'], {
  category: z.string().trim().max(60).optional(),
  rx: z.enum(['rx', 'otc']).optional(),
  stock: z.enum(['in', 'low', 'out', 'expiring', 'expired']).optional(),
  status: activeFilter,
  branch: id().optional(),
});

export const batchReceiveSchema = z.object({
  medicine_id: id('Medicine'),
  supplier: optionalText('Supplier', 120),
  branch_id: optionalId('Branch'),
  batch_no: requiredText('Lot number', 40),
  expiry_date: isoDate('Expiry date').refine((d) => d > phToday(), 'Expiry date must be in the future. Do not receive expired stock.'),
  // Optional: leave blank when the cost is not known. Used only for stock value and profit.
  cost_price: z.preprocess((v) => (v === '' || v === null || v === undefined ? 0 : v), money('Cost price')),
  quantity: qty(),
});
export const batchUpdateSchema = z.object({
  batch_no: requiredText('Lot number', 40),
  expiry_date: isoDate('Expiry date'),
  cost_price: money('Cost price'),
  supplier: optionalText('Supplier', 120),
});
export const adjustSchema = z.object({
  type: z.enum(['adjust', 'write_off'], { error: 'Choose an adjustment type.' }),
  qty_change: z.coerce.number().int('Quantity must be a whole number.').refine((n) => n !== 0, 'Quantity change cannot be zero.'),
  reason: requiredText('Reason', 255),
});
export const batchListQuery = listQuery(['expiry_date', 'qty_on_hand', 'received_at', 'generic_name'], {
  medicine: id().optional(),
  branch: id().optional(),
  expiry: z.enum(['expired', 'near', 'ok']).optional(),
  in_stock: bool.optional(),
});
export const movementListQuery = listQuery(['created_at'], {
  branch: id().optional(),
  medicine: id().optional(),
  batch: id().optional(),
  type: z.enum(['receive', 'sale', 'adjust', 'transfer_out', 'transfer_in', 'void_return', 'write_off']).optional(),
  from: optionalDate('From'),
  to: optionalDate('To'),
});

const rxItem = z.object({ medicine_id: id('Medicine'), quantity: qty(), instructions: optionalText('Instructions', 255) });
export const prescriptionSchema = z.object({
  customer_id: id('Customer'),
  doctor_name: requiredText('Prescriber name', 120),
  doctor_license_no: requiredText('Prescriber license number', 30),
  date_issued: isoDate('Date written').refine((d) => d <= phToday(), 'The date written cannot be in the future.'),
  notes: optionalText('Notes', 500),
  branch_id: optionalId('Branch'),
  // A pharmacist recording the prescription can verify it in the same step.
  verify: bool.default(false),
  items: z.array(rxItem).min(1, 'Add at least one medicine.').max(20)
    .refine((items) => new Set(items.map((i) => i.medicine_id)).size === items.length, 'Each medicine can only be listed once.'),
});
export const rejectSchema = z.object({ reason: requiredText('Reason', 255) });
export const prescriptionListQuery = listQuery(['created_at', 'date_issued', 'status'], {
  status: z.enum(['pending', 'verified', 'partially_dispensed', 'dispensed', 'rejected', 'dispensable']).optional(),
  customer: id().optional(),
  branch: id().optional(),
});

export const saleSchema = z.object({
  customer_id: optionalId('Customer'),
  prescription_id: optionalId('Prescription'),
  discount_type: z.enum(['none', 'senior', 'pwd']).default('none'),
  payment_method: z.enum(['cash', 'gcash', 'card'], { error: 'Choose a payment method.' }),
  amount_tendered: money('Amount tendered').optional(),
  payment_ref: optionalText('Reference number', 60),
  items: z.array(z.object({ medicine_id: id('Medicine'), quantity: qty() })).min(1, 'The cart is empty.').max(100),
}).refine((s) => s.payment_method === 'cash' || s.payment_ref, {
  message: 'Enter the GCash or card reference number.', path: ['payment_ref'],
}).refine((s) => s.discount_type === 'none' || s.customer_id, {
  message: 'Select the Senior Citizen or PWD customer to apply the discount.', path: ['customer_id'],
});
export const voidSchema = z.object({ reason: requiredText('Reason', 255) });
export const saleListQuery = listQuery(['created_at', 'total', 'receipt_no'], {
  branch: id().optional(),
  status: z.enum(['completed', 'voided']).optional(),
  payment: z.enum(['cash', 'gcash', 'card']).optional(),
  customer: id().optional(),
  cashier: id().optional(),
  from: optionalDate('From'),
  to: optionalDate('To'),
});

export const transferSchema = z.object({
  from_branch_id: optionalId('Sending branch'),
  to_branch_id: id('Receiving branch'),
  notes: optionalText('Notes', 255),
  items: z.array(z.object({ medicine_id: id('Medicine'), quantity: qty() })).min(1, 'Add at least one medicine.').max(50)
    .refine((items) => new Set(items.map((i) => i.medicine_id)).size === items.length, 'Each medicine can only be listed once.'),
});

export const reportQuery = z.object({
  branch: id().optional(),
  from: optionalDate('From'),
  to: optionalDate('To'),
  format: z.enum(['json', 'csv']).default('json'),
});

export const branchOnlyQuery = z.object({ branch: id('Branch').optional() });
export const statusOnlyQuery = z.object({ status: activeFilter, q: z.string().trim().max(100).optional() });
