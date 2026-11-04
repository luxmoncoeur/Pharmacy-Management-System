-- Pharmacy Management System schema.
-- Compatible with MySQL 8 and MariaDB 10.4+ (XAMPP). Run before seed.sql.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS tbl_audit_log, tbl_transfer_items, tbl_transfers, tbl_stock_movements,
  tbl_sale_items, tbl_sales, tbl_prescribed_items, tbl_prescription, tbl_batches,
  tbl_medicines, tbl_suppliers, tbl_categories, tbl_customers, tbl_pharmacists,
  tbl_users, tbl_branches, sessions;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE tbl_branches (
  branch_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  address     VARCHAR(255) NOT NULL,
  phone       VARCHAR(20)  NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_branch_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_users (
  user_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id      INT UNSIGNED NULL,
  username       VARCHAR(50)  NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  role           ENUM('admin','manager','pharmacist','cashier') NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_username UNIQUE (username),
  CONSTRAINT fk_user_branch FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
  -- Everyone except the admin works at exactly one branch.
  CONSTRAINT chk_user_branch CHECK (role = 'admin' OR branch_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_pharmacists (
  pharmacist_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NULL,
  firstname       VARCHAR(60)  NOT NULL,
  lastname        VARCHAR(60)  NOT NULL,
  email           VARCHAR(120) NULL,
  phone           VARCHAR(20)  NULL,
  license_no      VARCHAR(30)  NOT NULL,
  license_expiry  DATE         NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_pharmacist_user UNIQUE (user_id),
  CONSTRAINT uq_pharmacist_license UNIQUE (license_no),
  CONSTRAINT uq_pharmacist_email UNIQUE (email),
  CONSTRAINT fk_pharmacist_user FOREIGN KEY (user_id) REFERENCES tbl_users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_customers (
  customer_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firstname         VARCHAR(60)  NOT NULL,
  lastname          VARCHAR(60)  NOT NULL,
  birthdate         DATE         NULL,
  phone             VARCHAR(20)  NULL,
  email             VARCHAR(120) NULL,
  address           VARCHAR(255) NULL,
  discount_id_type  ENUM('none','senior','pwd') NOT NULL DEFAULT 'none',
  discount_id_no    VARCHAR(40)  NULL,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_customer_email UNIQUE (email),
  CONSTRAINT chk_customer_discount CHECK (discount_id_type = 'none' OR discount_id_no IS NOT NULL),
  INDEX idx_customer_name (lastname, firstname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_categories (
  category_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(60) NOT NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_category_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_suppliers (
  supplier_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  contact_person  VARCHAR(120) NULL,
  phone           VARCHAR(20)  NULL,
  email           VARCHAR(120) NULL,
  address         VARCHAR(255) NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_supplier_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_medicines (
  medicine_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  generic_name           VARCHAR(120)  NOT NULL,
  brand                  VARCHAR(120)  NOT NULL,
  category_id            INT UNSIGNED  NOT NULL,
  dosage_form            VARCHAR(40)   NOT NULL,
  strength               VARCHAR(40)   NOT NULL,
  unit                   VARCHAR(20)   NOT NULL DEFAULT 'piece',
  price                  DECIMAL(10,2) NOT NULL,
  requires_prescription  TINYINT(1)    NOT NULL DEFAULT 0,
  reorder_level          INT UNSIGNED  NOT NULL DEFAULT 20,
  barcode                VARCHAR(32)   NULL,
  is_active              TINYINT(1)    NOT NULL DEFAULT 1,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_medicine_identity UNIQUE (generic_name, brand, strength, dosage_form),
  CONSTRAINT uq_medicine_barcode UNIQUE (barcode),
  CONSTRAINT fk_medicine_category FOREIGN KEY (category_id) REFERENCES tbl_categories(category_id),
  CONSTRAINT chk_medicine_price CHECK (price > 0),
  INDEX idx_medicine_brand (brand)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock lives on batches, never on the medicine row, so every unit has a known expiry and branch.
CREATE TABLE tbl_batches (
  batch_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medicine_id   INT UNSIGNED  NOT NULL,
  branch_id     INT UNSIGNED  NOT NULL,
  supplier_id   INT UNSIGNED  NULL,
  batch_no      VARCHAR(40)   NOT NULL,
  expiry_date   DATE          NOT NULL,
  cost_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  qty_received  INT UNSIGNED  NOT NULL,
  qty_on_hand   INT           NOT NULL,
  received_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_batch UNIQUE (medicine_id, branch_id, batch_no),
  CONSTRAINT fk_batch_medicine FOREIGN KEY (medicine_id) REFERENCES tbl_medicines(medicine_id),
  CONSTRAINT fk_batch_branch FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
  CONSTRAINT fk_batch_supplier FOREIGN KEY (supplier_id) REFERENCES tbl_suppliers(supplier_id),
  CONSTRAINT chk_batch_qty CHECK (qty_on_hand >= 0),
  CONSTRAINT chk_batch_cost CHECK (cost_price >= 0),
  INDEX idx_batch_fefo (branch_id, medicine_id, expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_prescription (
  prescription_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id        INT UNSIGNED NOT NULL,
  branch_id          INT UNSIGNED NOT NULL,
  pharmacist_id      INT UNSIGNED NULL,
  doctor_name        VARCHAR(120) NOT NULL,
  doctor_license_no  VARCHAR(30)  NOT NULL,
  date_issued        DATE         NOT NULL,
  notes              VARCHAR(500) NULL,
  status             ENUM('pending','verified','partially_dispensed','dispensed','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason   VARCHAR(255) NULL,
  reviewed_at        DATETIME     NULL,
  created_by         INT UNSIGNED NOT NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rx_customer FOREIGN KEY (customer_id) REFERENCES tbl_customers(customer_id),
  CONSTRAINT fk_rx_branch FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
  CONSTRAINT fk_rx_pharmacist FOREIGN KEY (pharmacist_id) REFERENCES tbl_pharmacists(pharmacist_id),
  CONSTRAINT fk_rx_creator FOREIGN KEY (created_by) REFERENCES tbl_users(user_id),
  INDEX idx_rx_status (branch_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_prescribed_items (
  item_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prescription_id  INT UNSIGNED NOT NULL,
  medicine_id      INT UNSIGNED NOT NULL,
  quantity         INT UNSIGNED NOT NULL,
  qty_dispensed    INT UNSIGNED NOT NULL DEFAULT 0,
  instructions     VARCHAR(255) NULL,
  CONSTRAINT uq_rx_medicine UNIQUE (prescription_id, medicine_id),
  CONSTRAINT fk_rxitem_rx FOREIGN KEY (prescription_id) REFERENCES tbl_prescription(prescription_id) ON DELETE CASCADE,
  CONSTRAINT fk_rxitem_medicine FOREIGN KEY (medicine_id) REFERENCES tbl_medicines(medicine_id),
  CONSTRAINT chk_rxitem_qty CHECK (quantity > 0 AND qty_dispensed <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_sales (
  sale_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_no       VARCHAR(40)   NOT NULL,
  branch_id        INT UNSIGNED  NOT NULL,
  cashier_id       INT UNSIGNED  NOT NULL,
  customer_id      INT UNSIGNED  NULL,
  prescription_id  INT UNSIGNED  NULL,
  subtotal         DECIMAL(12,2) NOT NULL,
  vatable_amount   DECIMAL(12,2) NOT NULL,
  vat_amount       DECIMAL(12,2) NOT NULL,
  vat_exempt       DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_type    ENUM('none','senior','pwd') NOT NULL DEFAULT 'none',
  discount_id_no   VARCHAR(40)   NULL,
  discount_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL,
  payment_method   ENUM('cash','gcash','card') NOT NULL,
  amount_tendered  DECIMAL(12,2) NOT NULL,
  change_due       DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_ref      VARCHAR(60)   NULL,
  status           ENUM('completed','voided') NOT NULL DEFAULT 'completed',
  voided_by        INT UNSIGNED  NULL,
  void_reason      VARCHAR(255)  NULL,
  voided_at        DATETIME      NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_receipt_no UNIQUE (receipt_no),
  CONSTRAINT fk_sale_branch FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
  CONSTRAINT fk_sale_cashier FOREIGN KEY (cashier_id) REFERENCES tbl_users(user_id),
  CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES tbl_customers(customer_id),
  CONSTRAINT fk_sale_rx FOREIGN KEY (prescription_id) REFERENCES tbl_prescription(prescription_id),
  CONSTRAINT fk_sale_voider FOREIGN KEY (voided_by) REFERENCES tbl_users(user_id),
  CONSTRAINT chk_sale_amounts CHECK (total >= 0 AND amount_tendered >= total),
  INDEX idx_sale_branch_date (branch_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per batch drawn: a single cart line can span two batches under FEFO.
CREATE TABLE tbl_sale_items (
  sale_item_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id       INT UNSIGNED  NOT NULL,
  medicine_id   INT UNSIGNED  NOT NULL,
  batch_id      INT UNSIGNED  NOT NULL,
  quantity      INT UNSIGNED  NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  line_total    DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_saleitem_sale FOREIGN KEY (sale_id) REFERENCES tbl_sales(sale_id) ON DELETE CASCADE,
  CONSTRAINT fk_saleitem_medicine FOREIGN KEY (medicine_id) REFERENCES tbl_medicines(medicine_id),
  CONSTRAINT fk_saleitem_batch FOREIGN KEY (batch_id) REFERENCES tbl_batches(batch_id),
  CONSTRAINT chk_saleitem_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_stock_movements (
  movement_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id     INT UNSIGNED NOT NULL,
  branch_id    INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  type         ENUM('receive','sale','adjust','transfer_out','transfer_in','void_return','write_off') NOT NULL,
  qty_change   INT          NOT NULL,
  ref_type     VARCHAR(20)  NULL,
  ref_id       INT UNSIGNED NULL,
  reason       VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_move_batch FOREIGN KEY (batch_id) REFERENCES tbl_batches(batch_id),
  CONSTRAINT fk_move_branch FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
  CONSTRAINT fk_move_user FOREIGN KEY (user_id) REFERENCES tbl_users(user_id),
  CONSTRAINT chk_move_nonzero CHECK (qty_change <> 0),
  INDEX idx_move_branch_date (branch_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_transfers (
  transfer_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  from_branch_id  INT UNSIGNED NOT NULL,
  to_branch_id    INT UNSIGNED NOT NULL,
  status          ENUM('requested','in_transit','received','cancelled') NOT NULL DEFAULT 'requested',
  notes           VARCHAR(255) NULL,
  requested_by    INT UNSIGNED NOT NULL,
  dispatched_by   INT UNSIGNED NULL,
  received_by     INT UNSIGNED NULL,
  dispatched_at   DATETIME     NULL,
  received_at     DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transfer_from FOREIGN KEY (from_branch_id) REFERENCES tbl_branches(branch_id),
  CONSTRAINT fk_transfer_to FOREIGN KEY (to_branch_id) REFERENCES tbl_branches(branch_id),
  CONSTRAINT fk_transfer_requester FOREIGN KEY (requested_by) REFERENCES tbl_users(user_id),
  CONSTRAINT fk_transfer_dispatcher FOREIGN KEY (dispatched_by) REFERENCES tbl_users(user_id),
  CONSTRAINT fk_transfer_receiver FOREIGN KEY (received_by) REFERENCES tbl_users(user_id),
  CONSTRAINT chk_transfer_branches CHECK (from_branch_id <> to_branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- batch_id is the source batch, filled in at dispatch (FEFO). dest_batch_id is created on receipt.
CREATE TABLE tbl_transfer_items (
  transfer_item_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transfer_id       INT UNSIGNED NOT NULL,
  medicine_id       INT UNSIGNED NOT NULL,
  quantity          INT UNSIGNED NOT NULL,
  batch_id          INT UNSIGNED NULL,
  dest_batch_id     INT UNSIGNED NULL,
  CONSTRAINT fk_titem_transfer FOREIGN KEY (transfer_id) REFERENCES tbl_transfers(transfer_id) ON DELETE CASCADE,
  CONSTRAINT fk_titem_medicine FOREIGN KEY (medicine_id) REFERENCES tbl_medicines(medicine_id),
  CONSTRAINT fk_titem_batch FOREIGN KEY (batch_id) REFERENCES tbl_batches(batch_id),
  CONSTRAINT fk_titem_dest_batch FOREIGN KEY (dest_batch_id) REFERENCES tbl_batches(batch_id),
  CONSTRAINT chk_titem_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_audit_log (
  log_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(40)  NOT NULL,
  entity      VARCHAR(40)  NOT NULL,
  entity_id   INT UNSIGNED NULL,
  details     TEXT         NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES tbl_users(user_id),
  INDEX idx_audit_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
