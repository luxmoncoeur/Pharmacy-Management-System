import express from "express";
import saleController from "../controllers/saleController.js";
import {
  checkSaleExists,
  validateSaleInput,
} from "../middleware/saleMiddleware.js";

const router = express.Router();

router.get("/", saleController.getAllSales);
router.get("/customer/:customerId", saleController.getSalesByCustomerId);
router.get("/:id", checkSaleExists, saleController.getSaleById);
router.post("/", validateSaleInput, saleController.createSale);
router.put(
  "/:id",
  checkSaleExists,
  validateSaleInput,
  saleController.updateSale,
);
router.delete("/:id", checkSaleExists, saleController.deleteSale);

export default router;
