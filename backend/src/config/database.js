import mysql from "mysql2";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export const dbConnection = () =>
  new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) return reject(err);

      connection.changeUser({ database: process.env.DB_NAME }, (selectErr) => {
        if (selectErr) return reject(selectErr);

        console.log(`Connected to MySQL database: ${process.env.DB_NAME}`);
        resolve(connection);
      });
    });
  });

connection.query("SELECT DATABASE() AS selectedDatabase", (err, rows) => {
  console.log(err || rows);
});

export default connection;
