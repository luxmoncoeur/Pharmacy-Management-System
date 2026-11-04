# Pharmacy Management System

A multi-branch pharmacy system with point of sale, batch and expiry inventory, prescription review and dispensing, inter-branch transfers, and sales and inventory reports.

Built for ITELEC1 / Integrative Programming 2 (Faith Colleges, College of Computing and Information Technology) by Dimapilis, Gutierrez, Lat, and Palmero.

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript (ES modules, Fetch API, async/await) |
| Backend | Node.js 20+, Express 5 |
| Database | MySQL 8 or MariaDB 10.4+ (XAMPP), `mysql2` driver with parameterized queries |
| Validation | `zod` on the server, matching checks in the browser |
| Auth | Session cookies (`express-session` stored in MySQL), `bcryptjs` password hashing |
| Tests | Node's built-in test runner with `supertest` |

## Features

- **Point of sale.** Search or scan a barcode, add items, then pay by cash (with change), GCash, or card. The receipt prints with a VAT breakdown.
- **Batch and expiry tracking.** Every unit belongs to a batch with a batch number and expiry date. Sales draw first-expiry-first-out (FEFO), and expired stock can never be sold.
- **Real-time stock.** Stock levels are calculated from batches. Each sale, void, receipt, adjustment, and transfer is written to a stock ledger in the same database transaction.
- **Prescriptions.** Staff record a prescription. A pharmacist verifies or rejects it, and it is then dispensed at the POS. Partial dispensing is tracked. Prescription-only (Rx) medicines cannot be sold without a verified prescription.
- **Senior citizen and PWD discounts.** These are VAT-exempt with 20% off, as required by RA 9994 and RA 10754. The customer's ID number is recorded on the sale.
- **Alerts.** The dashboard and Inventory page show low stock, near expiry (within 90 days), and expired stock. Reorder suggestions are based on 30 days of sales.
- **Inter-branch transfers.** A transfer is requested, dispatched by the sending branch, and received by the destination branch. Batch numbers and expiry dates travel with the stock.
- **Voids.** Branch managers can void a sale with a reason. Stock returns to its original batches, and the receipt is kept and marked as voided.
- **Reports.** Daily sales, sales by medicine (with gross profit), stock status, expiring stock, and branch summary. Each report can be downloaded as CSV.
- **Role-based access.** Admin, Branch Manager, Pharmacist, and Cashier. Access is enforced on the server, and branch data is isolated.
- **Audit log.** Records sign-ins, failed sign-ins, price changes, voids, adjustments, verifications, and account changes.
- **Interface.** Light and dark themes, keyboard support, and layouts that work from tablet to desktop.

## Setup

### 1. Requirements

- Node.js 20 or newer (`node -v`)
- MySQL 8 or MariaDB 10.4+. With XAMPP, start **MySQL** from the XAMPP control panel.

### 2. Install

```bash
git clone <your-repo-url> pharmacy-management-system
cd pharmacy-management-system
npm install
cp .env.example .env
```

Edit `.env` to match your MySQL account. XAMPP's default is user `root` with an empty password:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pharmacy_pms
SESSION_SECRET=<paste a long random string>
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Create the database

```bash
npm run db:setup
```

This creates `pharmacy_pms`, runs `database/schema.sql`, then loads `database/seed.sql`. You can also import the two files in phpMyAdmin, in that order.

The script **drops and recreates** all tables, so run it again whenever you want a fresh demo.

### 4. Run

```bash
npm start          # or: npm run dev   (restarts on file changes)
```

Open <http://localhost:3000>.

### Demo accounts

Every account uses the password **`Pharmacy123!`**. All seed data is fictional.

| Username | Role | Branch |
|---|---|---|
| `admin` | Administrator | All branches |
| `manager.main` | Branch manager | Main Branch |
| `pharmacist.main` | Pharmacist | Main Branch |
| `cashier.main` | Cashier | Main Branch |
| `manager.north` | Branch manager | North Branch |
| `pharmacist.north` | Pharmacist | North Branch |
| `cashier.north` | Cashier | North Branch |

The seed generates sales, expiry dates, and prescriptions relative to today, so the dashboard always has data. It includes expired, near-expiry, low-stock, and out-of-stock items, prescriptions waiting for review, and a pending transfer.

## Tests

```bash
npm test
```

This rebuilds a separate `pharmacy_pms_test` database, then runs 39 API tests. They cover:
- authentication, roles, and branch isolation
- CRUD, validation, and duplicate handling
- FEFO allocation and rollback on failure
- prescription rules and discount math
- voids, transfers, and ledger reconciliation

See [docs/TESTING.md](docs/TESTING.md) for results and the manual test checklist.

## Who can do what

| Action | Admin | Manager | Pharmacist | Cashier |
|---|:-:|:-:|:-:|:-:|
| Ring up sales (POS) | | ✓ | ✓ | ✓ |
| View sales | all branches | own branch | own branch | own sales |
| Void a sale | ✓ | ✓ | | |
| Record prescriptions | ✓ | ✓ | ✓ | |
| Verify or reject prescriptions | | | ✓ (linked license) | |
| Customers (add, edit) | ✓ | ✓ | ✓ | ✓ |
| Medicines catalog and prices | ✓ | ✓ | view | view |
| Receive stock | ✓ | ✓ | ✓ | |
| Adjust or write off stock | ✓ | ✓ | | |
| Transfers | ✓ | ✓ (own branch) | | |
| Reports and CSV | all branches | own branch | | |
| Staff accounts | ✓ | view own branch | | |
| Branches, pharmacists, audit log | ✓ | view pharmacists | | |

## Project structure

```
database/           schema.sql (tables, keys, constraints) and seed.sql (generated sample data)
scripts/            db-setup.js, generate-seed.js
src/
  app.js            Express app: security headers, sessions, routes, static files
  server.js         Starts the app after checking the database connection
  config/           env, MySQL pool + withTransaction(), pricing rules (VAT, discounts)
  routes/index.js   Every endpoint with its role guard and validation schema
  middleware/       auth (requireAuth, requireRole, branch scoping), validate, errors, security
  validators/       zod schemas for every request body and query
  controllers/      HTTP handlers (one file per resource)
  models/           SQL queries (one file per resource)
  services/         Transactional workflows: checkout, FEFO inventory, transfers, reports
  utils/            Response helpers, audit logger, pricing, SQL helpers
public/
  index.html        App shell        login.html   Sign-in page
  css/              tokens (light and dark), base, components, layout
  js/               api.js (Fetch wrapper), router, session, ui/ (dialogs, lists, forms), views/ (one per page)
tests/              API tests
docs/               API reference, ERD, design notes, testing, Postman collection
```

Each request follows the team's original layering:

```
Browser (fetch) → routes → validate + auth middleware → controller → model / service → MySQL
```

## Documentation

- [API reference](docs/API.md)
- [Database design and ERD](docs/ERD.md)
- [Design direction](docs/DESIGN.md)
- [Testing](docs/TESTING.md)
- [Postman collection](docs/pharmacy.postman_collection.json)

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot connect to MySQL` on start | Start MySQL in XAMPP, check `DB_USER`, `DB_PASSWORD`, and `DB_PORT` in `.env`, then run `npm run db:setup`. |
| `ER_ACCESS_DENIED_ERROR` | The MySQL password in `.env` is wrong. XAMPP's root password is empty by default. |
| Port 3000 already in use | Set `PORT=3001` in `.env`. |
| Signed out after `npm run db:setup` | Expected: the script recreates the sessions table. Sign in again. |
| Dashboard shows no sales today | The seed places today's sales a few minutes before the time you ran it. Make a sale at the POS. |

## Known limitations

- No online ordering, delivery, insurance, or hospital integration, and no automatic supplier purchase orders (out of scope per the proposal).
- The system does not replace a pharmacist's professional judgment. Verification records that a pharmacist checked the prescription.
- Receipts are not BIR-accredited official receipts. The header contains placeholder business details.
- Barcode scanning assumes a USB or Bluetooth scanner in keyboard mode. There is no camera scanning.
