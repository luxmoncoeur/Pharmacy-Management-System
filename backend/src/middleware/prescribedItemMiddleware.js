import PrescribedItem from "../models/prescribedItemModel.js";

export const checkPrescribedItemExists = async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const item = await PrescribedItem.getById(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Prescribed item not found",
      });
    }

    req.prescribedItem = item;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database Verification Error",
      error: error.message,
    });
  }
};

export const validatePrescribedItemInput = (req, res, next) => {
  const { prescription_id, medicine_id, quantity } = req.body;

  if (!prescription_id || !medicine_id || quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: "prescription_id, medicine_id, and quantity are required",
    });
  }

  if (isNaN(quantity) || Number(quantity) <= 0) {
    return res.status(400).json({
      success: false,
      message: "quantity must be a valid number greater than 0",
    });
  }

  next();
};
