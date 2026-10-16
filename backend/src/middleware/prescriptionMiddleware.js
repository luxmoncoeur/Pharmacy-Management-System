import Customer from "../models/customerModel.js";
import Pharmacist from "../models/pharmacistModel.js";
import Prescription from "../models/prescriptionModel.js";

export const checkPrescriptionExists = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.getById(id);

    if (!prescription || prescription.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Prescription with ID ${id} not found`,
      });
    }

    req.prescription = prescription;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database Verification Error",
      error: error.message,
    });
  }
};

export const checkFKExists = async (req, res, next) => {
  try {
    const { customer_id, pharmacist_id } = req.body;

    const customerId = customer_id || req.params.customer_id;
    const pharmacistId = pharmacist_id || req.params.pharmacist_id;

    if (customerId) {
      const customer = await Customer.getById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: `Customer with ID ${customerId} not found.`,
        });
      }
      req.customer = customer;
    }

    if (pharmacistId) {
      const pharmacist = await Pharmacist.getById(pharmacistId);
      if (!pharmacist) {
        return res.status(404).json({
          success: false,
          message: `Pharmacist with ID ${pharmacistId} not found`,
        });
      }
      req.pharmacist = pharmacist;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database Verification Error.",
      error: error.message,
    });
  }
};
