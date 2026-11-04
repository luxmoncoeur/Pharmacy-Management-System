import { Router } from 'express';
import { requireAuth, requireRole, requireOwner } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/security.js';
import { idParams } from '../validators/common.js';
import * as s from '../validators/schemas.js';

import auth from '../controllers/authController.js';
import branches from '../controllers/branchController.js';
import users from '../controllers/userController.js';
import customers from '../controllers/customerController.js';
import lookups from '../controllers/lookupController.js';
import medicines from '../controllers/medicineController.js';
import inventory from '../controllers/inventoryController.js';
import prescriptions from '../controllers/prescriptionController.js';
import sales from '../controllers/saleController.js';
import transfers from '../controllers/transferController.js';
import reports from '../controllers/reportController.js';

// Three roles. A manager with no branch is the owner (see requireOwner); everyone else works at one branch.
const MANAGER = ['manager'];
const STOCK = ['manager', 'pharmacist'];
const PHARMACIST = ['pharmacist'];

const id = validate({ params: idParams });
const manager = requireRole(...MANAGER);
const router = Router();

router.post('/auth/login', loginLimiter, validate({ body: s.loginSchema }), auth.login);
router.post('/auth/logout', auth.logout);

router.use(requireAuth);

router.get('/auth/me', auth.me);
router.patch('/auth/me/password', validate({ body: s.changePasswordSchema }), auth.changePassword);

router.get('/branches', branches.list);
router.get('/branches/:id', id, branches.get);
router.post('/branches', requireOwner, validate({ body: s.branchSchema }), branches.create);
router.put('/branches/:id', requireOwner, validate({ params: idParams, body: s.branchSchema }), branches.update);
router.delete('/branches/:id', requireOwner, id, branches.deactivate);

router.get('/users', manager, validate({ query: s.userListQuery }), users.list);
router.get('/users/:id', manager, id, users.get);
router.post('/users', requireOwner, validate({ body: s.userCreateSchema }), users.create);
router.put('/users/:id', requireOwner, validate({ params: idParams, body: s.userUpdateSchema }), users.update);
router.delete('/users/:id', requireOwner, id, users.deactivate);

router.get('/customers', validate({ query: s.customerListQuery }), customers.list);
router.get('/customers/:id', id, customers.get);
router.get('/customers/:id/history', id, customers.history);
router.post('/customers', validate({ body: s.customerSchema }), customers.create);
router.put('/customers/:id', validate({ params: idParams, body: s.customerSchema }), customers.update);
router.delete('/customers/:id', requireRole(...STOCK), id, customers.deactivate);

// Suggestions for the free-text category and supplier fields.
router.get('/categories', lookups.categories);
router.get('/suppliers', lookups.suppliers);

router.get('/medicines', validate({ query: s.medicineListQuery }), medicines.list);
router.get('/medicines/barcode/:code', medicines.byBarcode);
router.get('/medicines/:id', validate({ params: idParams, query: s.branchOnlyQuery }), medicines.get);
router.post('/medicines', manager, validate({ body: s.medicineSchema }), medicines.create);
router.put('/medicines/:id', manager, validate({ params: idParams, body: s.medicineSchema }), medicines.update);
router.delete('/medicines/:id', manager, id, medicines.deactivate);

router.get('/batches', validate({ query: s.batchListQuery }), inventory.listBatches);
router.get('/batches/:id', id, inventory.getBatch);
router.post('/batches', requireRole(...STOCK), validate({ body: s.batchReceiveSchema }), inventory.receive);
router.patch('/batches/:id', manager, validate({ params: idParams, body: s.batchUpdateSchema }), inventory.updateBatch);
// Pharmacists may remove expired or damaged stock; count corrections are checked for a manager in the controller.
router.post('/batches/:id/adjust', requireRole(...STOCK), validate({ params: idParams, body: s.adjustSchema }), inventory.adjust);

router.get('/inventory/alerts', validate({ query: s.branchOnlyQuery }), inventory.alerts);
router.get('/inventory/reorder', requireRole(...STOCK), validate({ query: s.branchOnlyQuery }), inventory.reorder);
router.get('/inventory/movements', requireRole(...STOCK), validate({ query: s.movementListQuery }), inventory.movements);

// Anyone at the counter can record a prescription; only a pharmacist can verify or reject it.
router.get('/prescriptions', validate({ query: s.prescriptionListQuery }), prescriptions.list);
router.get('/prescriptions/:id', id, prescriptions.get);
router.post('/prescriptions', validate({ body: s.prescriptionSchema }), prescriptions.create);
router.put('/prescriptions/:id', validate({ params: idParams, body: s.prescriptionSchema }), prescriptions.update);
router.delete('/prescriptions/:id', id, prescriptions.remove);
router.post('/prescriptions/:id/verify', requireRole(...PHARMACIST), id, prescriptions.verify);
router.post('/prescriptions/:id/reject', requireRole(...PHARMACIST), validate({ params: idParams, body: s.rejectSchema }), prescriptions.reject);

router.get('/sales', validate({ query: s.saleListQuery }), sales.list);
router.get('/sales/:id', id, sales.get);
router.post('/sales', validate({ body: s.saleSchema }), sales.create);
router.post('/sales/:id/void', manager, validate({ params: idParams, body: s.voidSchema }), sales.void);

router.post('/transfers', manager, validate({ body: s.transferSchema }), transfers.create);

router.get('/dashboard', validate({ query: s.branchOnlyQuery }), reports.dashboard);
router.get('/reports/:name', manager, validate({ query: s.reportQuery }), reports.run);

export default router;
