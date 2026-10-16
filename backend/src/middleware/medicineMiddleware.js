import Medicine from "../models/medicineModel.js";

export const checkMedicineExists = async (req, res, next) => {
  try {
    const medicineId = req.params.id;
    const medicine = await Medicine.getById(medicineId);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    req.medicine = medicine;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database Verification Error",
      error: error.message,
    });
  }
};
