import express from "express";
import prescriptionController from "../controllers/prescriptionController.js";

import {
  checkPrescriptionExists,
  checkFKExists,
} from "../middleware/prescriptionMiddleware.js";

const router = express.Router();

// GET ALL /api/prescriptions
router.get("/", prescriptionController.getAllPrescriptions);

// GET BY ID /api/prescriptions/:id
router.get(
  "/:id",
  checkPrescriptionExists,
  prescriptionController.getPrescriptionById,
);

// POST api/prescriptions
router.post("/", checkFKExists, prescriptionController.createPrescription);

export default router;
