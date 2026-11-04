# Testing

## Automated API tests

Run with `npm test`. This rebuilds the `pharmacy_pms_test` database from `database/schema.sql` and `database/seed.sql`, then runs every file in `tests/` against the real Express app and MySQL using `supertest`.

| File | Covers |
|---|---|
| `tests/auth.test.js` | 401 without a session, generic sign-in errors, body validation, malformed JSON, role denials (403), branch isolation, cross-site POST blocking, password rules, immediate sign-out after deactivation |
| `tests/crud.test.js` | Full medicine CRUD with archive, duplicate detection (409 plus field), validation (400), not found (404), search and filters, discount ID rule, protecting a category in use, keeping at least one admin |
| `tests/inventory.test.js` | Receiving creates a batch and a ledger entry, expired deliveries rejected, adjustments cannot go below zero, cross-branch adjustment denied, alerts (shortages evaluated per branch), transfer stock conservation and branch rules |
| `tests/sales.test.js` | Server-side VAT, FEFO order, FEFO split across batches, expired stock never sold, full rollback on failure, insufficient cash, Rx gate, full prescription workflow (pending, verified, partial, dispensed), senior discount math, discount ID check, void returning stock, admin has no till, dashboard and CSV match the database |

After each stock operation, the tests also check that every batch's `qty_on_hand` equals the sum of its ledger movements.

### Latest run

Recorded on 2026-11-04 with Node 24.7 and MariaDB 10.4.28 (XAMPP).

```text
✔ rejects requests without a session (401)
✔ rejects a wrong password with a generic message
✔ validates the login body (400 with field errors)
✔ returns 400 for malformed JSON
✔ signs in and returns the current user without the password hash
✔ a cashier cannot create medicines or view reports (403)
✔ a manager only sees their own branch
✔ blocks cross-site POST requests by Origin
✔ rejects a weak new password and accepts a strong one
✔ a deactivated user is signed out on the next request
✔ medicine CRUD: create, read, update, archive
✔ rejects duplicates with 409 and a field error
✔ validates medicine fields (400)
✔ returns 404 for a missing record and 400 for a bad id
✔ search and filters narrow the medicine list
✔ customer requires an ID number for a senior discount
✔ category in use cannot be deleted (409)
✔ the last active administrator cannot be deactivated
✔ receiving stock creates a batch and a ledger entry
✔ refuses to receive already-expired stock
✔ adjustment cannot push a batch below zero
✔ a manager cannot adjust another branch's batch
✔ alerts list expired, near-expiry and low-stock items
✔ transfer moves stock between branches and conserves units
✔ transfer dispatch fails when the source lacks stock
✔ admin alerts count shortages per branch, not combined stock
✔ cash sale deducts stock and computes VAT server-side
✔ FEFO: the earliest-expiring sellable batch is used first
✔ a sale larger than one batch is split across batches
✔ expired stock is never sold
✔ a failed sale rolls back completely
✔ insufficient cash is rejected
✔ prescription-only medicine needs a verified prescription
✔ prescription workflow: record, verify, dispense partially, then fully
✔ senior discount: VAT-exempt and 20% off
✔ discount is refused for a customer without a matching ID
✔ void returns stock to the original batches; only managers can void
✔ admin has no till and cannot ring up sales
✔ dashboard and reports are computed from data
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3562.898708
```

## Browser checks

All 4 roles were signed in with headless Chrome. Every page they can reach was loaded with no page errors and no failed API calls. These flows were run end to end:

- A cashier scans a barcode, adds items, changes a quantity, adds an Rx medicine (checkout is blocked with "Prescription required"), removes it, pays cash, and gets a receipt.
- A cashier loads a verified prescription for a senior citizen. The cart fills with the prescribed quantities and the discount applies (VAT-exempt plus 20%). The receipt shows the breakdown and the ID number.
- A pharmacist opens a pending prescription and verifies it. Submitting an empty "Record prescription" form shows every field error at once.
- A manager views the dashboard in dark theme with the chart tooltip, and opens a transfer.
- The POS and the slide-out navigation were checked at tablet width (820px).

## Manual test checklist (final demo sequence)

| # | Demo step | How to show it | Expected |
|---|---|---|---|
| 1 | Problem and users | README introduction and the access table | |
| 2 | Architecture and ERD | `docs/ERD.md` and README "Project structure" | |
| 3 | Tables and relationships | phpMyAdmin → `pharmacy_pms` → Designer | 16 tables with foreign keys |
| 4 | Create a record | Medicines → Add medicine | Toast; the row appears with 0 stock and "Out of stock" |
| 5 | Retrieve records | Medicines list, open a row | Details with branch stock and batches |
| 6 | Update | Edit the medicine price | Toast; the audit log shows `price_change` |
| 7 | Delete or archive | Archive the medicine; also delete a pending prescription | Hidden from the list; still visible under "Archived" |
| 8 | Search and filter | Medicines: search "para", Rx filter, Low stock filter | The list narrows |
| 9 | Dashboard | Sign in as `manager.main` | Figures match Reports → Daily sales |
| 10 | Additional features | FEFO at the POS (Inventory → batch shows the earliest batch decreasing), senior discount, prescription verification, transfers, CSV reports, void | |
| 11 | Frontend to REST API | DevTools → Network while completing a sale | `POST /api/sales` → 201 JSON |
| 12 | Backend to MySQL | `src/config/db.js` (pool, `withTransaction`) and `src/services/checkoutService.js` | |
| 13 | Validation and errors | Submit an empty form; sell more than is in stock; cashier opens `/api/reports/daily-sales` | 400 with field messages; 409 "Only N in stock"; 403 |
| 14 | Tests and limitations | `npm test`, this file, README "Known limitations" | 39 passing |
