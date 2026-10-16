import Customer from "../models/customerModel.js";

export const checkCustomerExists = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.getById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    req.customer = customer;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database Verification Error",
      error: error.message,
    });
  }
};
