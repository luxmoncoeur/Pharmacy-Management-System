import db from "../config/database.js";

const Medicine = {
  // Get all medicine
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM tbl_medicines", (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },

  // Get medicines by ID
  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_medicines WHERE medicine_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  // Get medicines by name
  getByName: (name) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_medicines WHERE name = ?",
        [name],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Get medicines by brand
  getByBrand: (brand) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_medicines WHERE brand = ?",
        [brand],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Get medicines by category
  getByCategory: (category) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_medicines WHERE category = ?",
        [category],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Add new medicine
  create: (medicineData) => {
    return new Promise((resolve, reject) => {
      const { name, brand, category, price, stock, requires_prescription } =
        medicineData;
      db.query(
        "INSERT INTO tbl_medicines (name, brand, category, price, stock, requires_prescription) VALUES (?, ?, ?, ?, ?, ?)",
        [name, brand, category, price, stock, requires_prescription],
        (err, results) => {
          if (err) return reject(err);
          resolve({ id: results.insertId, ...medicineData });
        },
      );
    });
  },

  // Update medicine
  update: (id, medicineData) => {
    return new Promise((resolve, reject) => {
      const { name, brand, category, price, stock, requires_prescription } =
        medicineData;
      db.query(
        "UPDATE tbl_medicines SET name = ?, brand = ?, category = ?, price = ?, stock = ?, requires_prescription = ? WHERE medicine_id = ?",
        [name, brand, category, price, stock, requires_prescription, id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Delete medicine
  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "DELETE FROM tbl_medicines WHERE medicine_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },
};

export default Medicine;
