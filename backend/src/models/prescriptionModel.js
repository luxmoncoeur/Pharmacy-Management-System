import db from "../config/database.js";

const Prescription = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT 
          p.*,
          c.firstname AS customer_first_name,
          c.lastname AS customer_last_name,
          ph.firstname AS pharmacist_first_name,
          ph.lastname AS pharmacist_last_name,
          m.name AS medicine_name,
          pi.quantity
        FROM tbl_prescription p
        JOIN tbl_customers c ON p.customer_ID = c.customer_id
        JOIN tbl_pharmacists ph ON p.pharmacist_id = ph.pharmacist_id
        JOIN tbl_prescribed_items pi ON p.prescription_id = pi.prescription_id
        JOIN tbl_medicines m ON pi.medicine_id = m.medicine_id`,
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT 
          p.*,
          c.firstname AS customer_first_name,
          c.lastname AS customer_last_name,
          ph.firstname AS pharmacist_first_name,
          ph.lastname AS pharmacist_last_name,
          m.name AS medicine_name,
          pi.quantity
        FROM tbl_prescription p
        JOIN tbl_customers c ON p.customer_ID = c.customer_id
        JOIN tbl_pharmacists ph ON p.pharmacist_id = ph.pharmacist_id
        JOIN tbl_prescribed_items pi ON p.prescription_id = pi.prescription_id
        JOIN tbl_medicines m ON pi.medicine_id = m.medicine_id
        WHERE p.prescription_id = ?`,
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  create: (prescriptionData) => {
    return new Promise((resolve, reject) => {
      const {
        customer_id,
        pharmacist_id,
        doctor_name,
        license_no,
        date_issued,
        description,
      } = prescriptionData;
      db.query(
        "INSERT INTO tbl_prescription (customer_id, pharmacist_id, doctor_name, license_no, date_issued, description) VALUES (?, ?, ?, ?, ?, ?)",
        [
          customer_id,
          pharmacist_id,
          doctor_name,
          license_no,
          date_issued,
          description,
        ],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  createItem: (prescriptionId, medicineId, quantity) => {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO tbl_prescribed_items (prescription_id, medicine_id, quantity) 
        VALUES (?, ?, ?)
      `;

      db.query(
        query,
        [prescriptionId, medicineId, quantity],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },
};

export default Prescription;
