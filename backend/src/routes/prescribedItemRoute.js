import express from "express";
import prescribedItemController from "../controllers/prescribedItemController.js";
import {
  checkPrescribedItemExists,
  validatePrescribedItemInput,
} from "../middleware/prescribedItemMiddleware.js";

const router = express.Router();

router.get("/", prescribedItemController.getAllPrescribedItems);
router.get(
  "/prescription/:prescriptionId",
  prescribedItemController.getPrescribedItemsByPrescriptionId,
);
router.get(
  "/:id",
  checkPrescribedItemExists,
  prescribedItemController.getPrescribedItemById,
);
router.post(
  "/",
  validatePrescribedItemInput,
  prescribedItemController.createPrescribedItem,
);
router.put(
  "/:id",
  checkPrescribedItemExists,
  validatePrescribedItemInput,
  prescribedItemController.updatePrescribedItem,
);
router.delete(
  "/:id",
  checkPrescribedItemExists,
  prescribedItemController.deletePrescribedItem,
);

export default router;
