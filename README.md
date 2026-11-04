# Pharmacy Management System (POS & Inventory System)

**FAITH Colleges · College of Computing and Information Technology**
ITELEC1: Integrative Programming and Techniques · Full-Stack Information System Development

|                |                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Members**    | Dimapilis, James Harriet M. · Gutierrez, Ahron E. · Lat, Gio Angelo L. · Palmero, Jerome L. |
| **Instructor** | Mr. Bryan Christian Briones                                                                 |
| **Repository** | <https://github.com/luxmoncoeur/Pharmacy-Management-System>                                 |

Pharmacies need accurate records of medicine stock, expiry dates, sales, and prescriptions. Keeping these by hand is slow, and mistakes are easy to make. This system puts them in one place for every branch. It records sales through a point of sale (POS), deducts stock automatically, tracks batches and expiry dates, and handles prescription review and dispensing.

## Users

| Role                      | What they do                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **Owner / Administrator** | Manages branches, staff accounts, the medicine catalog, and reports for all branches             |
| **Branch Manager**        | Monitors inventory and sales, receives and adjusts stock, and handles transfers for their branch |
| **Pharmacist**            | Reviews and verifies prescriptions, dispenses medicine, and receives stock                       |
| **Cashier**               | Processes purchases, records payments, and prints receipts                                       |

## Core functions

1. **POS and sales processing with receipt generation**
2. **Inventory management:** stock levels update in real time after every sale
3. **Batch and expiry date tracking:** low-stock and near-expiry alerts
4. **Prescription review and dispensing**
5. **Sales and inventory reporting**

## Features

- **Point of sale:** search or scan a barcode, then pay by cash, GCash, or card. A printable receipt includes the VAT breakdown.
- **Automatic stock deduction:** every sale removes stock from the earliest-expiring batch first, and expired medicine cannot be sold.
- **Expiry and stock alerts:** the dashboard flags expired items, items expiring within 90 days, and items at or below their reorder level.
- **Prescriptions:** a prescription is recorded, verified by a pharmacist, then dispensed at the POS. Prescription-only (Rx) medicines need a verified prescription.
- **Senior citizen and PWD discounts:** 20% off and VAT-exempt, with the customer's ID number recorded on the sale.
- **Multi-branch:** each branch has its own stock and staff, and stock can be transferred between branches.
- **Reports:** daily sales, sales by medicine, stock status, expiring stock, and branch summary, each downloadable as CSV.
- **Dashboard:** today's sales, a 14-day sales chart, top sellers, and items that need attention.
- **Role-based access:** each user only sees and does what their role allows.
- **Records you can trust:** voided sales return stock to inventory, every stock change is logged, and an audit log records sensitive actions.
- **Search and filters** on every list, **light and dark themes**, and a layout that works on desktop and tablet.

## Tech stack

| Part            | Technology                                                                  |
| --------------- | --------------------------------------------------------------------------- |
| Frontend        | HTML, CSS, JavaScript (Fetch API, async/await)                              |
| Backend         | Node.js, Express                                                            |
| Database        | MySQL (XAMPP / MariaDB) via `mysql2`                                        |
| API             | REST API with JSON                                                          |
| Security        | Session login, `bcryptjs` password hashing, `helmet`, parameterized queries |
| Validation      | `zod` on the server, plus browser-side checks                               |
| Testing         | Node test runner, `supertest`, Postman                                      |
| Version control | Git and GitHub                                                              |

## File tree

```
Pharmacy-Management-System/
├── database/
│   ├── pharmacy_pms.sql        # Complete database in one file (import in phpMyAdmin)
│   ├── schema.sql              # Tables, primary/foreign keys, constraints
│   └── seed.sql                # Sample data (branches, users, medicines, sales)
├── docs/
│   ├── API.md                  # Every endpoint, request body, and status code
│   ├── ERD.md                  # Database design and entity-relationship diagram
│   ├── TESTING.md              # Test results and demo checklist
│   ├── DESIGN.md               # UI design decisions
│   └── pharmacy.postman_collection.json
├── public/                     # Frontend (served by Express)
│   ├── index.html              # Main app page
│   ├── login.html              # Sign-in page
│   ├── css/                    # Theme colors, base styles, components, layout
│   ├── icons/                  # Favicon and icon sprite
│   └── js/
│       ├── app.js              # Starts the app, sidebar, navigation by role
│       ├── api.js              # Fetch wrapper for calling the REST API
│       ├── router.js           # Page switching (#/dashboard, #/pos, ...)
│       ├── ui/                 # Reusable parts: dialogs, tables, forms, toasts
│       └── views/              # One file per page: pos, sales, medicines, inventory, ...
├── scripts/
│   ├── db-setup.js             # Creates the database (npm run db:setup)
│   ├── generate-seed.js        # Builds seed.sql
│   ├── build-sql.js            # Builds pharmacy_pms.sql from schema + seed
│   └── generate-postman.js     # Builds the Postman collection
├── src/                        # Backend (Node.js + Express)
│   ├── server.js               # Starts the server
│   ├── app.js                  # Express setup: security, sessions, routes
│   ├── config/                 # .env settings, MySQL connection, VAT/discount rates
│   ├── routes/                 # API endpoints and who can use them
│   ├── middleware/             # Login check, role check, validation, error handling
│   ├── validators/             # Input rules for every form
│   ├── controllers/            # Handle each request and send the response
│   ├── models/                 # SQL queries
│   ├── services/               # Checkout, stock (FEFO), transfers, reports
│   └── utils/                  # Shared helpers (responses, pricing, audit log)
├── tests/                      # Automated API tests (npm test)
├── .env.example                # Copy to .env and set your MySQL details
├── package.json
└── README.md
```

A request flows like this:

```
Browser (fetch) → routes → middleware → controller → model / service → MySQL
```

## How to set up

### Requirements

- [Node.js](https://nodejs.org) 20 or newer
- [XAMPP](https://www.apachefriends.org) (or any MySQL 8 / MariaDB 10.4+ server)

### Steps

1. **Start MySQL.** Open the XAMPP control panel and start **MySQL**. Also start **Apache** if you want to use phpMyAdmin.

2. **Download the project and install packages.**

   ```bash
   git clone https://github.com/luxmoncoeur/Pharmacy-Management-System.git
   cd Pharmacy-Management-System
   npm install
   ```

3. **Create your `.env` file.**

   ```bash
   cp .env.example .env
   ```

   On Windows Command Prompt, use `copy .env.example .env` instead.

   The defaults already match XAMPP (user `root`, no password). Change `DB_USER` or `DB_PASSWORD` only if your MySQL uses different credentials.

4. **Create the database with sample data.** Choose one:

   - **Terminal:**

     ```bash
     npm run db:setup
     ```

   - **phpMyAdmin:** open <http://localhost/phpmyadmin>, click the **Import** tab (with no database selected), choose `database/pharmacy_pms.sql`, and click **Import**.

   Either way you get the `pharmacy_pms` database with all tables and sample data. Doing it again resets everything to fresh sample data.

5. **Start the system.**
   ```bash
   npm start
   ```
   Open <http://localhost:3000> and sign in.

### Demo accounts

All accounts use the password **`Pharmacy123!`**. The sample data is fictional.

| Username           | Role           | Branch       |
| ------------------ | -------------- | ------------ |
| `admin`            | Administrator  | All branches |
| `manager.main`     | Branch Manager | Main Branch  |
| `pharmacist.main`  | Pharmacist     | Main Branch  |
| `cashier.main`     | Cashier        | Main Branch  |
| `manager.north`    | Branch Manager | North Branch |
| `pharmacist.north` | Pharmacist     | North Branch |
| `cashier.north`    | Cashier        | North Branch |

### Other commands

| Command       | What it does                                                |
| ------------- | ----------------------------------------------------------- |
| `npm run dev` | Starts the server and restarts it when files change         |
| `npm test`    | Runs the 39 automated API tests on a separate test database |

### Common problems

| Problem                             | Fix                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Cannot connect to MySQL`           | Make sure MySQL is running in XAMPP and `.env` has the right user and password, then run `npm run db:setup`. |
| Port 3000 is already in use         | Set `PORT=3001` in `.env`.                                                                                   |
| Signed out after `npm run db:setup` | Normal: the reset clears login sessions. Sign in again.                                                      |

## Documentation

- [API reference](docs/API.md): every endpoint, request body, and status code
- [Database design and ERD](docs/ERD.md)
- [Testing and results](docs/TESTING.md)
- [Design notes](docs/DESIGN.md)
- [Postman collection](docs/pharmacy.postman_collection.json)

## Limitations

- No online ordering or delivery, no insurance or hospital integration, and no automatic ordering from suppliers.
- The system supports, but does not replace, the professional judgment of a licensed pharmacist.
- Receipts are for demonstration and are not BIR-accredited official receipts.
