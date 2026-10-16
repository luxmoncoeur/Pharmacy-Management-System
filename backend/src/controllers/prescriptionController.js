import Prescription from "../models/prescriptionModel.js";

const prescriptionController = {
  getAllPrescriptions: async (req, res) => {
    try {
      const prescriptions = await Prescription.getAll();
      res.json({
        success: true,
        data: prescriptions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching prescriptions",
        error: error.message,
      });
    }
  },

  getPrescriptionById: async (req, res) => {
    res.json({
      success: true,
      data: req.prescription,
    });
  },

  createPrescription: async (req, res) => {
    try {
      const {
        customer_id,
        pharmacist_id,
        doctor_name,
        license_no,
        date_issued,
        description,
        medicine_id,
        quantity,
      } = req.body;

      // Unang Hakbang: I-save ang prescription core data
      const prescriptionResult = await Prescription.create({
        customer_id,
        pharmacist_id,
        doctor_name,
        license_no,
        date_issued,
        description,
      });

      const newPrescriptionId = prescriptionResult.insertId;

      await Prescription.createItem(newPrescriptionId, medicine_id, quantity);

      res.status(201).json({
        success: true,
        message: "Prescription and prescribed items created successfully!",
        prescription_id: newPrescriptionId,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error creating prescription",
        error: error.message,
      });
    }
  },
};

export default prescriptionController;
