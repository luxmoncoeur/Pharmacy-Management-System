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

Three roles, each with only what they need.

| Role | What they do |
| --- | --- |
| **Manager** | Runs a branch: medicines and prices, deliveries, sending stock to another branch, voiding sales, reports. A manager with **no branch** is the **owner**: they see every branch and also manage staff accounts and branches. |
| **Pharmacist** | Sells, checks and verifies prescriptions, receives deliveries, and removes expired or damaged stock. Their PRC license is saved on their account. |
| **Cashier** | Sells, gives out prescriptions a pharmacist has already checked, and adds customers. Can record a prescription, but a pharmacist must verify it. |

## Core functions

1. **Selling with receipts**
2. **Real-time stock:** stock goes down with every sale
3. **Expiry tracking:** every delivery is saved with its lot number and expiry date, with warnings for expired, expiring and low stock
4. **Prescription checking and giving out**
5. **Sales and stock reports**

## What's on the screen

The menu has 8 items (cashiers see 6):

| Page | What it is for |
| --- | --- |
| **Home** | Big buttons for the common jobs (New sale, Record a prescription, Receive delivery, Look up a medicine), today's sales, and one **Needs attention** list: expired first, then expiring soon, then running low. |
| **Sell** | Search or scan, pay by cash, GCash or card, print the receipt. Senior Citizen and PWD discounts (20% off, VAT-exempt). Medicines marked Rx need a checked prescription. |
| **Sales** | Past sales. Reprint a receipt; managers can void a sale and the stock goes back on the shelf. **Close the day** counts the cash drawer (bills and coins) against the day's cash sales, shows Balanced, Short or Over, and prints a closing slip to sign. |
| **Prescriptions** | Three steps: record what the paper says, a pharmacist checks it, then give it out at Sell. A pharmacist can **Save and verify** in one step. Every prescription has a **printable record** (patient, doctor and PRC no., medicines, the pharmacist who verified it and their PRC no., and what was given out) to show the patient, a doctor, or an inspector. |
| **Medicines & Stock** | One list with filter chips (Running low, Expiring soon, Expired, Out of stock). Open a medicine to see its stock by expiry date, receive a delivery, remove expired or damaged stock, send stock to another branch, and see its stock history. |
| **Customers** | Name, phone, and Senior Citizen or PWD ID, plus their purchases and prescriptions. |
| **Reports** | Sales summary, Best-selling medicines, and Stock and expiry. Each can be printed or downloaded for Excel. |
| **Settings** | Staff accounts, and Branches for the owner. Categories and suppliers are simply typed in where they are used, with suggestions. |

A **bell** at the top of every page shows notifications for each role, checked every minute: prescriptions to check (pharmacists), prescriptions checked or rejected (the cashier who recorded them), voided sales and expiring PRC licenses (managers), and expired, out-of-stock, low and expiring stock. New prescriptions also pop up, with optional desktop alerts.

Behind the scenes, the safety rules:
- Sell always takes the stock that expires first, and expired stock can never be sold. An expired lot can't be re-dated, and a lot that has sold units can only have its expiry moved earlier.
- Prescriptions are valid for 180 days from the date written.
- A failed sale saves nothing.
- Every stock change is recorded with who did it and why, and voided sales keep who voided them and the reason.

New staff can start with the [User guide](docs/USER_GUIDE.md).

## Tech stack

| Part            | Technology                                                                  |
| --------------- | --------------------------------------------------------------------------- |
| Frontend        | HTML, CSS, JavaScript (Fetch API, async/await)                              |
| Backend         | Node.js, Express                                                            |
| Database        | MySQL (XAMPP / MariaDB) via `mysql2`                                        |
| API             | REST API with JSON                                                          |
| Security        | Session login, `bcryptjs` password hashing, `helmet`, parameterized queries |
| Validation      | `zod` on the server, plus browser-side checks                               |
| API docs        | Swagger UI (`swagger-ui-express`) at `/api-docs`, from an OpenAPI 3 spec    |
| Testing         | Node test runner, `supertest`, Postman                                      |
| Version control | Git and GitHub                                                              |
| CI/CD           | GitHub Actions from [ci-cd-template](https://github.com/luxmoncoeur/ci-cd-template), ESLint, Conventional Commits, semantic-release |

## File tree

```
Pharmacy-Management-System/
├── .github/workflows/ci.yml    # CI: lint, API tests against MySQL, PR title check, automatic releases
├── database/
│   ├── pharmacy_pms.sql        # Complete database in one file (import in phpMyAdmin)
│   ├── schema.sql              # The 10 tables, primary/foreign keys, constraints
│   └── seed.sql                # Sample data (branches, users, medicines, sales)
├── docs/
│   ├── API.md                  # Every endpoint, request body, and status code
│   ├── ERD.md                  # Database design and entity-relationship diagram
│   ├── TESTING.md              # Test results and demo checklist
│   ├── DESIGN.md               # UI design decisions and why the system was simplified
│   ├── USER_GUIDE.md           # Step-by-step guide for pharmacists, cashiers and managers
│   └── pharmacy.postman_collection.json
├── public/                     # Frontend (served by Express)
│   ├── index.html              # Main app page
│   ├── login.html              # Sign-in page
│   ├── css/                    # Theme colors, base styles, components, layout
│   ├── icons/                  # Favicon and icon sprite
│   └── js/
│       ├── app.js              # Starts the app, sidebar, navigation by role
│       ├── api.js              # Fetch wrapper for calling the REST API
│       ├── router.js           # Page switching (#/home, #/pos, #/stock, ...)
│       ├── ui/                 # Reusable parts: dialogs, tables, forms, toasts
│       └── views/              # One file per page: dashboard (Home), pos (Sell), stock, prescriptions, settings, ...
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
│   ├── services/               # Checkout, stock (earliest expiry first), sending stock, reports
│   ├── docs/openapi.js         # OpenAPI spec shown by Swagger UI at /api-docs
│   └── utils/                  # Shared helpers (responses, pricing, receipt numbers)
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

| Username           | Role                     | Branch       |
| ------------------ | ------------------------ | ------------ |
| `manager`          | Owner (manager, no branch) | All branches |
| `manager.main`     | Manager                  | Main Branch  |
| `pharmacist.main`  | Pharmacist               | Main Branch  |
| `cashier.main`     | Cashier                  | Main Branch  |
| `manager.north`    | Manager                  | North Branch |
| `pharmacist.north` | Pharmacist               | North Branch |
| `cashier.north`    | Cashier                  | North Branch |

### Other commands

| Command       | What it does                                                |
| ------------- | ----------------------------------------------------------- |
| `npm run dev` | Starts the server and restarts it when files change         |
| `npm test`    | Runs the 58 automated API tests on a separate test database |

### Common problems

| Problem                             | Fix                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Cannot connect to MySQL`           | Make sure MySQL is running in XAMPP and `.env` has the right user and password, then run `npm run db:setup`. |
| Port 3000 is already in use         | Set `PORT=3001` in `.env`.                                                                                   |
| Signed out after `npm run db:setup` | Normal: the reset clears login sessions. Sign in again.                                                      |

## Documentation

- [API reference](docs/API.md): every endpoint, request body, and status code
- **Swagger UI:** with the server running, open <http://localhost:3000/api-docs> to browse and try every endpoint
- [Database design and ERD](docs/ERD.md): 10 tables, and what was simplified
- [Testing and results](docs/TESTING.md)
- [Design notes, including why and how the system was simplified](docs/DESIGN.md)
- [User guide for pharmacy staff](docs/USER_GUIDE.md)
- [Postman collection](docs/pharmacy.postman_collection.json)
- [Commit message cheat sheet](docs/conventional-commits.md)

## CI/CD

GitHub Actions runs [.github/workflows/ci.yml](.github/workflows/ci.yml) on every pull request and every push to `main`. It uses the reusable workflows from [ci-cd-template](https://github.com/luxmoncoeur/ci-cd-template), pinned to v1.1.0.

| Job | What it does |
| --- | --- |
| `checks` | `npm run lint` (ESLint), from the template |
| `test` | Starts a MySQL 8.4 container, builds the test database from `schema.sql` and `seed.sql`, and runs `npm test` |
| `release-preview` | Pull requests only: checks that the PR title is a Conventional Commit and comments which version merging it would release |
| `ci` | The single required check: passes only when the jobs above passed |
| `release` | On `main` after `ci` passes: semantic-release reads the commit messages, bumps the version in `package.json`, updates `CHANGELOG.md`, tags `vX.Y.Z`, and creates a GitHub Release |

**Commit messages decide the version** ([cheat sheet](docs/conventional-commits.md)): `feat: …` is a minor release, `fix: …` a patch, `feat!: …` or a `BREAKING CHANGE:` footer a major one, and `docs`, `chore`, `test`, `ci` or `refactor` release nothing. `npm install` sets up a git hook that checks each commit message; in CI the PR title is checked, because squash merges use it as the commit message.

There is no deploy step: the template's deploy targets Vercel, which does not suit an Express app with MySQL-backed sessions. Run the system locally with XAMPP as described above.

**One-time GitHub setup:** in Settings → General → Pull Requests, allow only squash merging and set the default commit message to "Pull request title and description". Then add a branch ruleset for `main` that requires a pull request and the `ci` status check. If `main` is protected this way, the release job needs a deploy key to push its release commit; see [Protecting main](https://github.com/luxmoncoeur/ci-cd-template#protecting-main) in the template README.

## Limitations

- No online ordering or delivery, no insurance or hospital integration, and no automatic ordering from suppliers.
- The system supports, but does not replace, the professional judgment of a licensed pharmacist.
- Receipts are for demonstration and are not BIR-accredited official receipts.
