import db from "../config/database.js";

const saleDetailsQuery = `
  SELECT
    s.*,
    CONCAT(c.firstname, ' ', c.lastname) AS customer_name,
    c.firstname AS customer_first_name,
    c.lastname AS customer_last_name,
    c.phone AS customer_phone,
    p.doctor_name,
    p.license_no,
    p.date_issued AS prescription_date_issued,
    p.description AS prescription_description
  FROM tbl_sales s
  JOIN tbl_customers c ON s.customer_id = c.customer_id
  JOIN tbl_prescription p ON s.prescription_id = p.prescription_id
`;

const Sale = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query(saleDetailsQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },

  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        `${saleDetailsQuery} WHERE s.sale_id = ?`,
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  getByCustomerId: (customerId) => {
    return new Promise((resolve, reject) => {
      db.query(
        `${saleDetailsQuery} WHERE s.customer_id = ?`,
        [customerId],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  create: (saleData) => {
    return new Promise((resolve, reject) => {
      const { customer_id, prescription_id, total_amount, payment_method } =
        saleData;
      db.query(
        "INSERT INTO tbl_sales (customer_id, prescription_id, total_amount, payment_method) VALUES (?, ?, ?, ?)",
        [customer_id, prescription_id, total_amount, payment_method],
        (err, results) => {
          if (err) return reject(err);
          resolve({ sale_id: results.insertId, ...saleData });
        },
      );
    });
  },

  update: (id, saleData) => {
    return new Promise((resolve, reject) => {
      const { customer_id, prescription_id, total_amount, payment_method } =
        saleData;
      db.query(
        "UPDATE tbl_sales SET customer_id = ?, prescription_id = ?, total_amount = ?, payment_method = ? WHERE sale_id = ?",
        [customer_id, prescription_id, total_amount, payment_method, id],
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
        "DELETE FROM tbl_sales WHERE sale_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },
};

export default Sale;
