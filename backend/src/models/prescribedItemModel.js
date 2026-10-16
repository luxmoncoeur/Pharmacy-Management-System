import db from "../config/database.js";

const PrescribedItems = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT
          pi.*,
          m.name AS medicine_name,
          m.brand AS medicine_brand,
          m.category AS medicine_category
        FROM tbl_prescribed_items pi
        JOIN tbl_medicines m ON pi.medicine_id = m.medicine_id`,
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Get by ID
  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT
          pi.*,
          m.name AS medicine_name,
          m.brand AS medicine_brand,
          m.category AS medicine_category
        FROM tbl_prescribed_items pi
        JOIN tbl_medicines m ON pi.medicine_id = m.medicine_id
        WHERE pi.prescribed_item_id = ?`,
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  // Get by Prescription ID
  getByPrescriptionId: (prescriptionId) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT
          pi.*,
          m.name AS medicine_name,
          m.brand AS medicine_brand,
          m.category AS medicine_category
        FROM tbl_prescribed_items pi
        JOIN tbl_medicines m ON pi.medicine_id = m.medicine_id
        WHERE pi.prescription_id = ?`,
        [prescriptionId],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  create: (itemData) => {
    return new Promise((resolve, reject) => {
      const { prescription_id, medicine_id, quantity } = itemData;
      db.query(
        "INSERT INTO tbl_prescribed_items (prescription_id, medicine_id, quantity) VALUES (?, ?, ?)",
        [prescription_id, medicine_id, quantity],
        (err, results) => {
          if (err) return reject(err);
          resolve({ prescribed_item_id: results.insertId, ...itemData });
        },
      );
    });
  },

  update: (id, itemData) => {
    return new Promise((resolve, reject) => {
      const { prescription_id, medicine_id, quantity } = itemData;
      db.query(
        "UPDATE tbl_prescribed_items SET prescription_id = ?, medicine_id = ?, quantity = ? WHERE prescribed_item_id = ?",
        [prescription_id, medicine_id, quantity, id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "DELETE FROM tbl_prescribed_items WHERE prescribed_item_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },
};

export default PrescribedItems;
