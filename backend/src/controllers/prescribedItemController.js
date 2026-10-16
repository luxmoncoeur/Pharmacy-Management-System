import PrescribedItem from "../models/prescribedItemModel.js";

const prescribedItemController = {
  getAllPrescribedItems: async (req, res) => {
    try {
      const prescribedItems = await PrescribedItem.getAll();
      res.json({
        success: true,
        message: "Prescribed items fetched successfully",
        data: prescribedItems,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching prescribed items",
        error: error.message,
      });
    }
  },

  getPrescribedItemById: async (req, res) => {
    res.json({
      success: true,
      message: "Prescribed item fetched successfully",
      data: req.prescribedItem,
    });
  },

  getPrescribedItemsByPrescriptionId: async (req, res) => {
    try {
      const prescribedItems = await PrescribedItem.getByPrescriptionId(
        req.params.prescriptionId,
      );
      res.json({
        success: true,
        message: "Prescribed items fetched successfully",
        data: prescribedItems,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching prescribed items",
        error: error.message,
      });
    }
  },

  createPrescribedItem: async (req, res) => {
    try {
      const prescribedItem = await PrescribedItem.create(req.body);
      res.status(201).json({
        success: true,
        message: "Prescribed item created successfully",
        data: prescribedItem,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error creating prescribed item",
        error: error.message,
      });
    }
  },

  updatePrescribedItem: async (req, res) => {
    try {
      await PrescribedItem.update(req.params.id, req.body);
      res.json({
        success: true,
        message: "Prescribed item updated successfully",
        data: { prescribed_item_id: Number(req.params.id), ...req.body },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating prescribed item",
        error: error.message,
      });
    }
  },

  deletePrescribedItem: async (req, res) => {
    try {
      await PrescribedItem.delete(req.params.id);
      res.json({
        success: true,
        message: "Prescribed item deleted successfully",
        data: { prescribed_item_id: Number(req.params.id) },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error deleting prescribed item",
        error: error.message,
      });
    }
  },
};

export default prescribedItemController;
