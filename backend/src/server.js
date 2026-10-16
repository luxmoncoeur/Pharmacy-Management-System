import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import { dbConnection } from "./config/database.js";

import customerRoutes from "./routes/customerRoute.js";
import medicineRoutes from "./routes/medicineRoute.js";
import pharmacistRoutes from "./routes/pharmacistRoute.js";
import prescriptionRoutes from "./routes/prescriptionRoute.js";
import prescribedItemRoutes from "./routes/prescribedItemRoute.js";
import saleRoutes from "./routes/saleRoute.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/customers", customerRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/pharmacists", pharmacistRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/prescribed-items", prescribedItemRoutes);
app.use("/api/sales", saleRoutes);

dbConnection()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server connected successfully");
      console.log(`Server connected to port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Server not started", err);
  });
