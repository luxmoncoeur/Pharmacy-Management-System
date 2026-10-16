import express from "express";
const router = express.Router();
import pharmacistController from "../controllers/pharmacistController.js";

import { checkPharmacistExists } from "../middleware/pharmacistMiddleware.js";

// GET /api/pharmacists
router.get("/", pharmacistController.getAllPharmacists);

// GET /api/pharmacists/:id
router.get(
  "/:id",
  checkPharmacistExists,
  pharmacistController.getPharmacistById,
);

// POST /api/pharmacists
router.post("/", pharmacistController.addPharmacist);

// GET /api/pharmacists/firstname/:firstName
router.get(
  "/firstname/:firstName",
  pharmacistController.getPharmacistByFirstName,
);

// GET /api/pharmacists/lastname/:lastName
router.get("/lastname/:lastName", pharmacistController.getPharmacistByLastName);

// GET /api/pharmacists/email/:email
router.get("/email/:email", pharmacistController.getByEmail);

// GET /api/pharmacists/phone/:phone
router.get("/phone/:phone", pharmacistController.getByPhone);

// GET /api/pharmacists/licenseno/:licenseNo
router.get("/licenseno/:licenseNo", pharmacistController.getByLicenseNo);

// PUT /api/pharmacists/:id
router.put(
  "/:id",
  checkPharmacistExists,
  pharmacistController.updatePharmacist,
);

// DELETE /api/pharmacists/:id
router.delete(
  "/:id",
  checkPharmacistExists,
  pharmacistController.deletePharmacist,
);
export default router;
