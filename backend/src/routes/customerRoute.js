import express from "express";
const router = express.Router();
import customerController from "../controllers/customerController.js";
import { checkCustomerExists } from "../middleware/customerMiddleware.js";

// GET /api/customers - Get all customers
router.get("/", customerController.getAllCustomers);

// GET /api/customers/email/:email - Get customer by email
router.get("/email/:email", customerController.getCustomerByEmail);

// GET /api/customers/:id/prescriptions - Get all prescriptions for a specific customer
router.get("/:id/prescriptions", customerController.getCustomerPrescriptions);

// // GET /api/customers/:id - Get customer by ID
router.get("/:id", checkCustomerExists, customerController.getCustomerById);

// POST /api/customer - Create new customer
router.post("/", customerController.addCustomer);

// PUT /api/customer/:id - Update customer
router.put("/:id", checkCustomerExists, customerController.updateCustomer);

// DELETE /api/customer/:id - Delete customer
router.delete("/:id", checkCustomerExists, customerController.deleteCustomer);

export default router;
