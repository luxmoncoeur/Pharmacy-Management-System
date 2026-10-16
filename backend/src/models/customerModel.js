import db from "../config/database.js";

const Customer = {
  // Get all customers
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM tbl_customers", (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },

  // Get customer by ID
  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_customers WHERE customer_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  // Create new customer
  create: (customerData) => {
    return new Promise((resolve, reject) => {
      const { firstname, lastname, age, phone, email, address } = customerData;
      db.query(
        "INSERT INTO tbl_customers (firstname, lastname, age, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)",
        [firstname, lastname, age, phone, email, address],
        (err, results) => {
          if (err) return reject(err);
          resolve({ id: results.insertId, ...customerData });
        },
      );
    });
  },

  // Update customer
  update: (id, customerData) => {
    return new Promise((resolve, reject) => {
      const { firstname, lastname, age, phone, email, address } = customerData;
      db.query(
        "UPDATE tbl_customers SET firstname = ?, lastname = ?, age = ?, phone = ?, email = ?, address = ? WHERE customer_id = ?",
        [firstname, lastname, age, phone, email, address, id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Delete customer
  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "DELETE FROM tbl_customers WHERE customer_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Get customers by email
  getByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_customers WHERE email = ?",
        [email],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  getPrescriptions: (customerId) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          p.prescription_id,
          p.customer_id,
          p.date_issued,
          p.doctor_name,
          p.description,
          CONCAT(ph.firstname, ' ', ph.lastname) AS pharmacist_name,
          m.name AS medicine_name,
          pi.quantity
        FROM tbl_prescription p
        JOIN tbl_pharmacists ph ON p.pharmacist_id = ph.pharmacist_id
        JOIN tbl_prescribed_items pi ON p.prescription_id = pi.prescription_id
        JOIN tbl_medicines m ON pi.medicine_id = m.medicine_id
        WHERE p.customer_id = ?;
      `;
      db.query(query, [customerId], (err, results) => {
        if (err) {
          console.error("Error fetching prescription:", err);
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  },
};

export default Customer;
