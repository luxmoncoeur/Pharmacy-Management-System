import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/security.js';
import { idParams } from '../validators/common.js';
import * as s from '../validators/schemas.js';

import auth from '../controllers/authController.js';
import branches from '../controllers/branchController.js';
import users from '../controllers/userController.js';
import pharmacists from '../controllers/pharmacistController.js';
import customers from '../controllers/customerController.js';
import { categoryController as categories, supplierController as suppliers } from '../controllers/lookupController.js';
import medicines from '../controllers/medicineController.js';
import inventory from '../controllers/inventoryController.js';
import prescriptions from '../controllers/prescriptionController.js';
import sales from '../controllers/saleController.js';
import transfers from '../controllers/transferController.js';
import reports from '../controllers/reportController.js';

const ADMIN = ['admin'];
const MANAGEMENT = ['admin', 'manager'];
const DISPENSING = ['manager', 'pharmacist'];
const SELLING = ['manager', 'pharmacist', 'cashier'];

const id = validate({ params: idParams });
const router = Router();

router.post('/auth/login', loginLimiter, validate({ body: s.loginSchema }), auth.login);
router.post('/auth/logout', auth.logout);

router.use(requireAuth);

router.get('/auth/me', auth.me);
router.patch('/auth/me/password', validate({ body: s.changePasswordSchema }), auth.changePassword);

router.get('/branches', branches.list);
router.get('/branches/:id', id, branches.get);
router.post('/branches', requireRole(...ADMIN), validate({ body: s.branchSchema }), branches.create);
router.put('/branches/:id', requireRole(...ADMIN), validate({ params: idParams, body: s.branchSchema }), branches.update);
router.delete('/branches/:id', requireRole(...ADMIN), id, branches.deactivate);

router.get('/users', requireRole(...MANAGEMENT), validate({ query: s.userListQuery }), users.list);
router.get('/users/:id', requireRole(...MANAGEMENT), id, users.get);
router.post('/users', requireRole(...ADMIN), validate({ body: s.userCreateSchema }), users.create);
router.put('/users/:id', requireRole(...ADMIN), validate({ params: idParams, body: s.userUpdateSchema }), users.update);
router.delete('/users/:id', requireRole(...ADMIN), id, users.deactivate);

router.get('/pharmacists', requireRole(...MANAGEMENT), pharmacists.list);
router.get('/pharmacists/:id', requireRole(...MANAGEMENT), id, pharmacists.get);
router.post('/pharmacists', requireRole(...ADMIN), validate({ body: s.pharmacistSchema }), pharmacists.create);
router.put('/pharmacists/:id', requireRole(...ADMIN), validate({ params: idParams, body: s.pharmacistSchema }), pharmacists.update);
router.delete('/pharmacists/:id', requireRole(...ADMIN), id, pharmacists.deactivate);

router.get('/customers', validate({ query: s.customerListQuery }), customers.list);
router.get('/customers/:id', id, customers.get);
router.get('/customers/:id/history', id, customers.history);
router.post('/customers', validate({ body: s.customerSchema }), customers.create);
router.put('/customers/:id', validate({ params: idParams, body: s.customerSchema }), customers.update);
router.delete('/customers/:id', requireRole(...MANAGEMENT, 'pharmacist'), id, customers.deactivate);

router.get('/categories', categories.list);
router.post('/categories', requireRole(...MANAGEMENT), validate({ body: s.categorySchema }), categories.create);
router.put('/categories/:id', requireRole(...MANAGEMENT), validate({ params: idParams, body: s.categorySchema }), categories.update);
router.delete('/categories/:id', requireRole(...MANAGEMENT), id, categories.remove);

router.get('/suppliers', suppliers.list);
router.get('/suppliers/:id', id, suppliers.get);
router.post('/suppliers', requireRole(...MANAGEMENT), validate({ body: s.supplierSchema }), suppliers.create);
router.put('/suppliers/:id', requireRole(...MANAGEMENT), validate({ params: idParams, body: s.supplierSchema }), suppliers.update);
router.delete('/suppliers/:id', requireRole(...MANAGEMENT), id, suppliers.deactivate);

router.get('/medicines', validate({ query: s.medicineListQuery }), medicines.list);
router.get('/medicines/barcode/:code', medicines.byBarcode);
router.get('/medicines/:id', validate({ params: idParams, query: s.branchOnlyQuery }), medicines.get);
router.post('/medicines', requireRole(...MANAGEMENT), validate({ body: s.medicineSchema }), medicines.create);
router.put('/medicines/:id', requireRole(...MANAGEMENT), validate({ params: idParams, body: s.medicineSchema }), medicines.update);
router.delete('/medicines/:id', requireRole(...MANAGEMENT), id, medicines.deactivate);

router.get('/batches', validate({ query: s.batchListQuery }), inventory.listBatches);
router.get('/batches/:id', id, inventory.getBatch);
router.post('/batches', requireRole('admin', ...DISPENSING), validate({ body: s.batchReceiveSchema }), inventory.receive);
router.patch('/batches/:id', requireRole(...MANAGEMENT), validate({ params: idParams, body: s.batchUpdateSchema }), inventory.updateBatch);
router.post('/batches/:id/adjust', requireRole(...MANAGEMENT), validate({ params: idParams, body: s.adjustSchema }), inventory.adjust);

router.get('/inventory/alerts', validate({ query: s.branchOnlyQuery }), inventory.alerts);
router.get('/inventory/reorder', requireRole(...MANAGEMENT, 'pharmacist'), validate({ query: s.branchOnlyQuery }), inventory.reorder);
router.get('/inventory/movements', requireRole(...MANAGEMENT), validate({ query: s.movementListQuery }), inventory.movements);

router.get('/prescriptions', validate({ query: s.prescriptionListQuery }), prescriptions.list);
router.get('/prescriptions/:id', id, prescriptions.get);
router.post('/prescriptions', requireRole('admin', ...DISPENSING), validate({ body: s.prescriptionSchema }), prescriptions.create);
router.put('/prescriptions/:id', requireRole('admin', ...DISPENSING), validate({ params: idParams, body: s.prescriptionSchema }), prescriptions.update);
router.delete('/prescriptions/:id', requireRole('admin', ...DISPENSING), id, prescriptions.remove);
router.post('/prescriptions/:id/verify', requireRole('pharmacist'), id, prescriptions.verify);
router.post('/prescriptions/:id/reject', requireRole('pharmacist'), validate({ params: idParams, body: s.rejectSchema }), prescriptions.reject);

router.get('/sales', validate({ query: s.saleListQuery }), sales.list);
router.get('/sales/:id', id, sales.get);
router.post('/sales', requireRole(...SELLING), validate({ body: s.saleSchema }), sales.create);
router.post('/sales/:id/void', requireRole(...MANAGEMENT), validate({ params: idParams, body: s.voidSchema }), sales.void);

router.get('/transfers', requireRole(...MANAGEMENT), validate({ query: s.transferListQuery }), transfers.list);
router.get('/transfers/:id', requireRole(...MANAGEMENT), id, transfers.get);
router.post('/transfers', requireRole(...MANAGEMENT), validate({ body: s.transferSchema }), transfers.create);
router.post('/transfers/:id/dispatch', requireRole(...MANAGEMENT), id, transfers.dispatch);
router.post('/transfers/:id/receive', requireRole(...MANAGEMENT), id, transfers.receive);
router.post('/transfers/:id/cancel', requireRole(...MANAGEMENT), id, transfers.cancel);

router.get('/dashboard', validate({ query: s.branchOnlyQuery }), reports.dashboard);
router.get('/reports/:name', requireRole(...MANAGEMENT), validate({ query: s.reportQuery }), reports.run);
router.get('/audit-log', requireRole(...ADMIN), validate({ query: s.auditListQuery }), reports.audit);

export default router;
