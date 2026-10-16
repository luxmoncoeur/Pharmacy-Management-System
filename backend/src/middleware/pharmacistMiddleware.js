import Pharmacist from "../models/pharmacistModel.js";

export const checkPharmacistExists = async (req, res, next) => {
  try {
    const pharmacistId = req.params.id;
    const pharmacist = await Pharmacist.getById(pharmacistId);

    if (!pharmacist) {
      return res.status(404).json({
        success: false,
        message: "Pharmacist not found",
      });
    }

    req.pharmacist = pharmacist;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database Verification Error",
      error: error.message,
    });
  }
};
