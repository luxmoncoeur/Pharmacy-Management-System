import db from "../config/database.js";

const Pharmacist = {
  // Get all pharmacist
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM tbl_pharmacists", (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },

  // Get by ID
  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_pharmacists WHERE pharmacist_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  // Get pharmacist by first name
  getByFirstName: (firstName) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_pharmacists WHERE firstname LIKE ?",
        [`%${firstName}%`],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Get pharmacist by last name
  getByLastName: (lastName) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_pharmacists WHERE lastname LIKE ?",
        [`%${lastName}%`],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Get pharmacist by email
  getByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_pharmacists WHERE email = ?",
        [email],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  // Get pharmacist by phone number
  getByPhone: (phone) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_pharmacists WHERE phone = ?",
        [phone],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  // Get pharmacist by license number
  getByLicenseNo: (license_no) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_pharmacists WHERE license_no = ?",
        [license_no],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  // Create pharmacist
  create: (pharmacistData) => {
    return new Promise((resolve, reject) => {
      const { firstname, lastname, email, phone, license_no } = pharmacistData;
      db.query(
        "INSERT INTO tbl_pharmacists (firstname, lastname, email, phone, license_no) VALUES (?, ?, ?, ?, ?)",
        [firstname, lastname, email, phone, license_no],
        (err, results) => {
          if (err) return reject(err);
          resolve({ id: results.insertId, ...pharmacistData });
        },
      );
    });
  },

  // Update
  update: (id, pharmacistData) => {
    return new Promise((resolve, reject) => {
      const { firstname, lastname, email, phone, license_no } = pharmacistData;
      db.query(
        "UPDATE tbl_pharmacists SET firstname = ?, lastname = ?, email = ?, phone = ?, license_no = ? WHERE id = ?",
        [firstname, lastname, email, phone, license_no, id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },

  // Delete
  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "DELETE FROM tbl_pharmacists WHERE pharmacist_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        },
      );
    });
  },
};

export default Pharmacist;
