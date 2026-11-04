# Database design

The schema is `database/schema.sql`. It uses InnoDB, utf8mb4, `INT UNSIGNED` surrogate keys, and explicit foreign keys. History tables use `ON DELETE RESTRICT`, so sales, batches, and prescriptions are never orphaned. Master data is deactivated with `is_active` rather than deleted.

```mermaid
erDiagram
  tbl_branches ||--o{ tbl_users : "employs"
  tbl_branches ||--o{ tbl_batches : "holds"
  tbl_branches ||--o{ tbl_sales : "records"
  tbl_branches ||--o{ tbl_prescription : "receives"
  tbl_users ||--o| tbl_pharmacists : "is licensed as"
  tbl_categories ||--o{ tbl_medicines : "groups"
  tbl_medicines ||--o{ tbl_batches : "stocked as"
  tbl_suppliers ||--o{ tbl_batches : "supplies"
  tbl_customers ||--o{ tbl_prescription : "presents"
  tbl_pharmacists ||--o{ tbl_prescription : "reviews"
  tbl_prescription ||--|{ tbl_prescribed_items : "lists"
  tbl_medicines ||--o{ tbl_prescribed_items : "prescribed as"
  tbl_customers ||--o{ tbl_sales : "buys"
  tbl_prescription ||--o{ tbl_sales : "dispensed by"
  tbl_users ||--o{ tbl_sales : "rings up"
  tbl_sales ||--|{ tbl_sale_items : "contains"
  tbl_batches ||--o{ tbl_sale_items : "drawn from"
  tbl_batches ||--o{ tbl_stock_movements : "changed by"
  tbl_users ||--o{ tbl_stock_movements : "performed"
  tbl_transfers ||--|{ tbl_transfer_items : "ships"
  tbl_branches ||--o{ tbl_transfers : "sends / receives"
  tbl_batches ||--o{ tbl_transfer_items : "source / destination"
  tbl_users ||--o{ tbl_audit_log : "did"

  tbl_medicines {
    int medicine_id PK
    varchar generic_name
    varchar brand
    int category_id FK
    varchar dosage_form
    varchar strength
    decimal price "CHECK > 0"
    bool requires_prescription
    int reorder_level
    varchar barcode UK
  }
  tbl_batches {
    int batch_id PK
    int medicine_id FK
    int branch_id FK
    int supplier_id FK
    varchar batch_no "UK with medicine and branch"
    date expiry_date
    decimal cost_price
    int qty_received
    int qty_on_hand "CHECK >= 0"
  }
  tbl_sales {
    int sale_id PK
    varchar receipt_no UK
    int branch_id FK
    int cashier_id FK
    int customer_id FK "nullable: walk-in"
    int prescription_id FK "nullable"
    decimal subtotal
    decimal vat_amount
    decimal discount_amount
    decimal total
    enum payment_method
    enum status "completed or voided"
  }
  tbl_prescription {
    int prescription_id PK
    int customer_id FK
    int branch_id FK
    int pharmacist_id FK "reviewer"
    varchar doctor_name
    varchar doctor_license_no
    date date_issued
    enum status
  }
  tbl_stock_movements {
    int movement_id PK
    int batch_id FK
    int branch_id FK
    int user_id FK
    enum type
    int qty_change "signed, CHECK <> 0"
    varchar reason
  }
```

## Tables

The six tables from the approved proposal are kept with the same names. The others support the features the proposal describes.

| Table | Purpose | Key constraints |
|---|---|---|
| `tbl_branches` | Pharmacy branches | `name` unique |
| `tbl_users` | Sign-in accounts and roles | `username` unique; CHECK: non-admins must have a branch |
| `tbl_pharmacists` | Licensed pharmacists (proposal table) | `license_no`, `email`, `user_id` unique |
| `tbl_customers` | Patients and customers (proposal table) | `email` unique; CHECK: discount type needs an ID number |
| `tbl_categories` | Medicine categories | `name` unique |
| `tbl_suppliers` | Distributors | `name` unique |
| `tbl_medicines` | Catalog (proposal table) | unique (generic, brand, strength, form); `barcode` unique; CHECK price > 0 |
| `tbl_batches` | Stock per medicine, per branch, per expiry date | unique (medicine, branch, batch_no); CHECK qty_on_hand ≥ 0; index for FEFO lookups |
| `tbl_prescription` | Prescriptions (proposal table) | FK customer, branch, reviewer, creator |
| `tbl_prescribed_items` | Medicines on a prescription (proposal table) | unique (prescription, medicine); CHECK dispensed ≤ prescribed |
| `tbl_sales` | Sale header (proposal table) | `receipt_no` unique; CHECK tendered ≥ total |
| `tbl_sale_items` | Sale lines, one per batch drawn | FK sale, medicine, batch |
| `tbl_stock_movements` | Ledger of every stock change | CHECK qty_change ≠ 0 |
| `tbl_transfers`, `tbl_transfer_items` | Inter-branch transfers | CHECK from ≠ to |
| `tbl_audit_log` | Sensitive actions | index on date |

## Design decisions

- **Stock lives on batches, not on the medicine row.** The proposal lists "stock quantity" on medicines. Storing it on batches instead means every unit has a known expiry date and branch, so expiry alerts and FEFO are possible. The medicine's stock is a `SUM` over its sellable batches.
- **The ledger reconciles exactly.** For every batch, `qty_on_hand` equals the sum of `tbl_stock_movements.qty_change`. The automated tests check this after each stock operation.
- **One sale line per batch.** If a cart line needs units from two batches, it is stored as two `tbl_sale_items` rows. The receipt groups them and lists both batch numbers, which allows recall tracing.
- **Walk-in sales.** `customer_id` and `prescription_id` on sales are nullable, which the original API did not allow.
- **Money is `DECIMAL`.** Totals are computed in integer centavos in Node, so there is no floating-point drift.
