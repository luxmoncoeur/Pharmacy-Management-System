import Sale from "../models/saleModel.js";

const saleController = {
  getAllSales: async (req, res) => {
    try {
      const sales = await Sale.getAll();
      res.json({
        success: true,
        message: "Sales fetched successfully",
        data: sales,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching sales",
        error: error.message,
      });
    }
  },

  getSaleById: async (req, res) => {
    res.json({
      success: true,
      message: "Sale fetched successfully",
      data: req.sale,
    });
  },

  getSalesByCustomerId: async (req, res) => {
    try {
      const sales = await Sale.getByCustomerId(req.params.customerId);
      res.json({
        success: true,
        message: "Customer sales fetched successfully",
        data: sales,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching customer sales",
        error: error.message,
      });
    }
  },

  createSale: async (req, res) => {
    try {
      const sale = await Sale.create(req.body);
      res.status(201).json({
        success: true,
        message: "Sale created successfully",
        data: sale,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error creating sale",
        error: error.message,
      });
    }
  },

  updateSale: async (req, res) => {
    try {
      await Sale.update(req.params.id, req.body);
      res.json({
        success: true,
        message: "Sale updated successfully",
        data: { sale_id: Number(req.params.id), ...req.body },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating sale",
        error: error.message,
      });
    }
  },

  deleteSale: async (req, res) => {
    try {
      await Sale.delete(req.params.id);
      res.json({
        success: true,
        message: "Sale deleted successfully",
        data: { sale_id: Number(req.params.id) },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error deleting sale",
        error: error.message,
      });
    }
  },
};

export default saleController;
