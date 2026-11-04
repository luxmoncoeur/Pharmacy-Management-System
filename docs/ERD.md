# Database design

The schema is `database/schema.sql`: **10 tables**, InnoDB, utf8mb4, `INT UNSIGNED` surrogate keys, and explicit foreign keys. History tables use `ON DELETE RESTRICT`, so sales, lots and prescriptions are never orphaned. Master data is deactivated with `is_active` rather than deleted.

```mermaid
erDiagram
  tbl_branches ||--o{ tbl_users : "employs"
  tbl_branches ||--o{ tbl_batches : "holds"
  tbl_branches ||--o{ tbl_sales : "records"
  tbl_branches ||--o{ tbl_prescription : "receives"
  tbl_medicines ||--o{ tbl_batches : "stocked as"
  tbl_customers ||--o{ tbl_prescription : "presents"
  tbl_users ||--o{ tbl_prescription : "verifies (pharmacist)"
  tbl_prescription ||--|{ tbl_prescribed_items : "lists"
  tbl_medicines ||--o{ tbl_prescribed_items : "prescribed as"
  tbl_customers ||--o{ tbl_sales : "buys"
  tbl_prescription ||--o{ tbl_sales : "given out by"
  tbl_users ||--o{ tbl_sales : "rings up"
  tbl_sales ||--|{ tbl_sale_items : "contains"
  tbl_batches ||--o{ tbl_sale_items : "drawn from"
  tbl_batches ||--o{ tbl_stock_movements : "changed by"
  tbl_users ||--o{ tbl_stock_movements : "performed"

  tbl_users {
    int user_id PK
    int branch_id FK "NULL only for the owner (a manager)"
    varchar username UK
    enum role "manager, pharmacist or cashier"
    varchar license_no UK "pharmacists only"
    date license_expiry "pharmacists only"
  }
  tbl_medicines {
    int medicine_id PK
    varchar generic_name
    varchar brand
    varchar category "free text"
    varchar dosage_form
    varchar strength
    decimal price "CHECK > 0"
    bool requires_prescription
    int reorder_level
    varchar barcode UK
  }
  tbl_batches {
    int batch_id PK "a lot"
    int medicine_id FK
    int branch_id FK
    varchar supplier "free text, optional"
    varchar batch_no "UK with medicine and branch"
    date expiry_date
    decimal cost_price
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
    decimal amount_tendered "change = tendered - total"
    enum payment_method
    enum status "completed or voided"
  }
  tbl_prescription {
    int prescription_id PK
    int customer_id FK
    int branch_id FK
    int reviewed_by FK "pharmacist user"
    varchar doctor_name
    varchar doctor_license_no
    date date_issued
    enum status
  }
  tbl_stock_movements {
    int movement_id PK
    int batch_id FK "the lot also gives the branch"
    int user_id FK
    enum type
    int qty_change "signed, CHECK <> 0"
    varchar ref_type "sale, batch or branch"
    int ref_id
    varchar reason
  }
```

## Tables

| Table | Purpose | Key constraints |
|---|---|---|
| `tbl_branches` | Pharmacy branches | `name` unique |
| `tbl_users` | Sign-in accounts, roles, and pharmacist licenses | `username` and `license_no` unique; CHECK: only managers may have no branch; CHECK: pharmacists must have a license and expiry |
| `tbl_customers` | Patients and customers (proposal table) | CHECK: discount type needs an ID number |
| `tbl_medicines` | Catalogue (proposal table) | unique (generic, brand, strength, form); `barcode` unique; CHECK price > 0 |
| `tbl_batches` | Lots: stock per medicine, per branch, per expiry date | unique (medicine, branch, lot no.); CHECK qty_on_hand ≥ 0; index for earliest-expiry lookups |
| `tbl_prescription` | Prescriptions (proposal table) | FK customer, branch, reviewer, creator |
| `tbl_prescribed_items` | Medicines on a prescription (proposal table) | unique (prescription, medicine); CHECK given out ≤ prescribed |
| `tbl_sales` | Sale header (proposal table) | `receipt_no` unique; CHECK tendered ≥ total |
| `tbl_sale_items` | Sale lines, one per lot drawn | FK sale, medicine, lot |
| `tbl_stock_movements` | Stock history: every change to every lot | CHECK qty_change ≠ 0 |

The `sessions` table is created by the sign-in library (`express-mysql-session`) and is not part of the design.

## Design decisions

- **Stock lives on lots, not on the medicine row.** The proposal lists "stock quantity" on medicines. Storing it on lots instead means every unit has a known expiry date and branch, so expiry warnings and earliest-expiry-first selling are possible. A medicine's stock is a `SUM` over its sellable lots.
- **Stock history reconciles exactly.** For every lot, `qty_on_hand` equals the sum of `tbl_stock_movements.qty_change`. The automated tests check this after each stock operation.
- **One sale line per lot.** If a cart line needs units from two lots, it is stored as two `tbl_sale_items` rows. The receipt groups them and lists both lot numbers, which allows recall tracing.
- **Walk-in sales.** `customer_id` and `prescription_id` on sales are nullable.
- **Money is `DECIMAL`.** Totals are computed in integer centavos in Node, so there is no floating-point drift.

## Simplification

The first version had 17 tables. It was complete, but too much for a school pharmacy system and its users. It was narrowed in two steps without losing any function.

| Removed | Now | Why it still works |
|---|---|---|
| `tbl_pharmacists` | `license_no`, `license_expiry` on `tbl_users` | A pharmacist is a staff account. The license is in one place, and the reviewer of a prescription (`reviewed_by`) is the user who signed in. |
| `tbl_categories` | `category` text on `tbl_medicines` | Typing a category suggests the ones already in use (`GET /categories`), so spelling stays consistent. |
| `tbl_suppliers` | `supplier` text on `tbl_batches` (optional) | Same: suggestions come from past deliveries (`GET /suppliers`). |
| `tbl_transfers`, `tbl_transfer_items` | Two lines in `tbl_stock_movements` | Sending stock writes `transfer_out` on the sending lot and `transfer_in` on the receiving lot, each with `ref_type = 'branch'` and the other branch's ID. Lot numbers and expiry dates carry over. |
| `tbl_audit_log` | Records already on the data | Voids keep who, when and why on the sale (`voided_by`, `voided_at`, `void_reason`). Every stock change keeps who and why in stock history. Prescriptions keep who recorded and who verified them. |
| Unused columns | Dropped | `updated_at` on every table, the second timestamp on lots, `qty_received`, `change_due` (calculated as tendered minus total), and the branch on stock history (it comes from the lot). |
| Admin role, 4-state transfers, customer email, address and birthdate | Removed | See `docs/DESIGN.md`. |

Five of the six tables named in the approved proposal are kept under the same names (`tbl_customers`, `tbl_medicines`, `tbl_prescription`, `tbl_prescribed_items`, `tbl_sales`). The sixth, `tbl_pharmacists`, was merged into `tbl_users` as described above.
