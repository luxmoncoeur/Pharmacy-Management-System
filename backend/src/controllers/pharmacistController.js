import Pharmacist from "../models/pharmacistModel.js";

const pharmacistController = {
  // Get all pharmacists
  getAllPharmacists: async (req, res) => {
    try {
      const pharmacists = await Pharmacist.getAll();
      res.json({
        success: true,
        data: pharmacists,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching pharmacists",
        error: error.message,
      });
    }
  },

  // Get pharmacist by ID
  getPharmacistById: async (req, res) => {
    res.json({
      success: true,
      data: req.pharmacist,
    });
  },

  // Get pharmacist by first name
  getPharmacistByFirstName: async (req, res) => {
    try {
      const { firstName } = req.params;
      const pharmacist = await Pharmacist.getByFirstName(firstName);

      res.json({
        success: true,
        data: pharmacist,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching pharmacist by first name.",
        error: error.message,
      });
    }
  },

  // Get pharmacist by last name
  getPharmacistByLastName: async (req, res) => {
    try {
      const { lastName } = req.params;
      const pharmacist = await Pharmacist.getByLastName(lastName);

      res.json({
        success: true,
        data: pharmacist,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching pharmacist by last name.",
        error: error.message,
      });
    }
  },

  getByEmail: async (req, res) => {
    try {
      const { email } = req.params;
      const pharmacist = await Pharmacist.getByEmail(email);

      if (!pharmacist)
        return res.status(404).json({
          success: false,
          message: "Pharmacist not found with this email",
        });

      res.json({ success: true, data: pharmacist });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getByPhone: async (req, res) => {
    try {
      const { phone } = req.params;
      const pharmacist = await Pharmacist.getByPhone(phone);

      if (!pharmacist)
        return res.status(404).json({
          success: false,
          message: "Pharmacist not found with this phone number",
        });

      res.json({ success: true, data: pharmacist });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getByLicenseNo: async (req, res) => {
    try {
      const { licenseNo } = req.params;
      const pharmacist = await Pharmacist.getByLicenseNo(licenseNo);

      if (!pharmacist)
        return res.status(404).json({
          success: false,
          message: "Pharmacist not found with this license number",
        });

      res.json({ success: true, data: pharmacist });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  // Add pharmacist
  addPharmacist: async (req, res) => {
    try {
      const { firstName, lastName, email, phone, licenseNo } = req.body;

      if (!firstName || !lastName || !email || !phone || !licenseNo) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }

      await Pharmacist.create({
        firstname: firstName,
        lastname: lastName,
        email,
        phone,
        license_no: licenseNo,
      });

      res
        .status(201)
        .json({ success: true, message: "Pharmacist added successfully" });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error adding pharmacist.",
        error: error.message,
      });
    }
  },

  // Update pharmacist
  updatePharmacist: async (req, res) => {
    try {
      const { firstName, lastName, email, phone, licenseNo } = req.body;
      const pharmacistId = req.params.id;

      if (!firstName || !lastName || !email || !phone || !licenseNo) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }

      await Pharmacist.update(pharmacistId, {
        firstname: firstName,
        lastname: lastName,
        email,
        phone,
        license_no: licenseNo,
      });

      res.json({ success: true, message: "Pharmacist updated successfully" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Delete pharmacist
  deletePharmacist: async (req, res) => {
    try {
      await Pharmacist.delete(req.params.id);
      res.json({ success: true, message: "Pharmacist deleted successfully" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default pharmacistController;
