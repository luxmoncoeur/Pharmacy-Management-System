import Medicine from "../models/medicineModel.js";

const medicineController = {
  // Get all medicines
  getAllMedicines: async (req, res) => {
    try {
      const medicines = await Medicine.getAll();
      res.json({
        success: true,
        data: medicines,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching medicines",
        error: error.message,
      });
    }
  },

  // Get medicine by ID
  getMedicineById: async (req, res) => {
    res.json({
      success: true,
      data: req.medicine,
    });
  },

  // Add new medicine
  addMedicine: async (req, res) => {
    try {
      const { name, brand, category, price, stock, requires_prescription } =
        req.body;

      // Validation
      if (
        !name ||
        !brand ||
        !category ||
        price === undefined ||
        stock === undefined ||
        requires_prescription === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields (name, brand, category, price, stock, requires_prescription) are required",
        });
      }

      const newMedicine = await Medicine.create({
        name,
        brand,
        category,
        price,
        stock,
        requires_prescription,
      });

      res.status(201).json({
        success: true,
        message: "Medicine added successfully",
        data: newMedicine,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error adding medicine",
        error: error.message,
      });
    }
  },

  // Get medicine by name
  getMedicineByName: async (req, res) => {
    try {
      const { name } = req.params;
      const medicines = await Medicine.getByName(name);

      res.json({
        success: true,
        data: medicines,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching medicine by name.",
        error: error.message,
      });
    }
  },

  // Get medicine by brand
  getMedicineByBrand: async (req, res) => {
    try {
      const { brand } = req.params;
      const medicines = await Medicine.getByBrand(brand);

      res.json({
        success: true,
        data: medicines,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching medicine by brand.",
        error: error.message,
      });
    }
  },

  // Get medicine by category
  getMedicineByCategory: async (req, res) => {
    try {
      const { category } = req.params;
      const medicines = await Medicine.getByCategory(category);

      res.json({
        success: true,
        data: medicines,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching medicine by category.",
        error: error.message,
      });
    }
  },

  // Update medicine
  updateMedicine: async (req, res) => {
    try {
      const { name, brand, category, price, stock, requires_prescription } =
        req.body;
      const medicineId = req.params.id;

      if (
        !name ||
        !brand ||
        !category ||
        price === undefined ||
        stock === undefined ||
        requires_prescription === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      await Medicine.update(medicineId, {
        name,
        brand,
        category,
        price,
        stock,
        requires_prescription,
      });
      res.json({ success: true, message: "Medicine updated successfully" });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating medicine",
        error: error.message,
      });
    }
  },

  // Delete medicine
  deleteMedicine: async (req, res) => {
    try {
      await Medicine.delete(req.params.id);
      res.json({ success: true, message: "Medicine deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          message: "Error deleting medicine",
          error: error.message,
        });
    }
  },
};

export default medicineController;
