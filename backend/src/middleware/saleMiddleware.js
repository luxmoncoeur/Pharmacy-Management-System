import Sale from "../models/saleModel.js";

export const checkSaleExists = async (req, res, next) => {
  try {
    const sale = await Sale.getById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    req.sale = sale;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database verification error",
      error: error.message,
    });
  }
};

export const validateSaleInput = (req, res, next) => {
  const { customer_id, prescription_id, total_amount, payment_method } =
    req.body;

  if (
    customer_id === undefined ||
    prescription_id === undefined ||
    total_amount === undefined ||
    !payment_method ||
    !String(payment_method).trim()
  ) {
    return res.status(400).json({
      success: false,
      message:
        "customer_id, prescription_id, total_amount, and payment_method are required",
    });
  }

  if (!Number.isInteger(Number(customer_id)) || Number(customer_id) <= 0) {
    return res.status(400).json({
      success: false,
      message: "customer_id must be a positive integer",
    });
  }

  if (
    !Number.isInteger(Number(prescription_id)) ||
    Number(prescription_id) <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "prescription_id must be a positive integer",
    });
  }

  if (!Number.isFinite(Number(total_amount)) || Number(total_amount) < 0) {
    return res.status(400).json({
      success: false,
      message: "total_amount must be a valid number greater than or equal to 0",
    });
  }

  next();
};
