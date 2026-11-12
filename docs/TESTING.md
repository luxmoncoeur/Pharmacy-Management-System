# Testing

## Automated API tests

Run with `npm test`. This rebuilds the `pharmacy_pms_test` database from `database/schema.sql` and `database/seed.sql`, then runs every file in `tests/` against the real Express app and MySQL using `supertest`.

| File | Covers |
|---|---|
| `tests/auth.test.js` | 401 without a session, generic sign-in errors, body validation, malformed JSON, role denials (403), branch isolation, cross-site POST blocking, password rules, owner-only staff and branch management, pharmacist accounts need a PRC license, immediate sign-out after deactivation, Swagger UI served and the OpenAPI spec covers every route |
| `tests/crud.test.js` | Full medicine CRUD with archive, duplicate detection (409 plus field), validation (400), not found (404), search and filters (including expiring and expired), discount ID rule, protecting a category in use, keeping at least one owner |
| `tests/inventory.test.js` | Receiving creates a lot and a history entry, expired deliveries rejected, corrections cannot go below zero, cross-branch changes denied, pharmacists can remove expired stock but not correct counts, one-step transfer keeps lot numbers and expiry dates, a short transfer moves nothing, a branch manager cannot send from another branch, alerts evaluated per branch, an expired lot cannot be re-dated, a lot with sales can only have its expiry moved earlier, a new lot's typo can be fixed, a repeat delivery of the same lot adds to it (a different expiry is refused) |
| `tests/sales.test.js` | Server-side VAT, earliest-expiry-first order and split across lots, expired stock never sold, full rollback on failure, insufficient cash, Rx gate, full prescription workflow (pending, verified, partial, given out) and printable record data, cashier-recorded prescriptions wait for a pharmacist, pharmacist save-and-verify, senior discount math, discount ID check, void returning stock, the owner has no till, Home and CSV match the database, prescriptions older than 180 days cannot be verified or given out |
| `tests/notifications.test.js` | A pharmacist is notified of a new prescription and the cashier when it is checked, the sidebar count matches the pending list, cashiers get no stock or license notifications, a void is shown to the owner but not to the manager who did it, the end-of-day cash summary adds up one person's sales, and who may see whose cash summary |

After each stock operation, the tests also check that every batch's `qty_on_hand` equals the sum of its ledger movements.

### Latest run

Recorded on 2026-11-12 with Node 24.7 and MariaDB 10.4.28 (XAMPP). CI runs the same suite on every pull request against MySQL 8.4.

```text
✔ rejects requests without a session (401)
✔ rejects a wrong password with a generic message
✔ validates the login body (400 with field errors)
✔ returns 400 for malformed JSON
✔ signs in and returns the current user without the password hash
✔ a cashier cannot create medicines or view reports (403)
✔ a branch manager only sees their own branch
✔ blocks cross-site POST requests by Origin
✔ rejects a weak new password and accepts a strong one
✔ only the owner manages staff accounts and branches; a branch manager cannot
✔ a pharmacist account needs a PRC license
✔ a deactivated user is signed out on the next request
✔ Swagger UI is served and the OpenAPI spec documents every route
✔ medicine CRUD: create, read, update, archive
✔ rejects duplicates with 409 and a field error
✔ validates medicine fields (400)
✔ returns 404 for a missing record and 400 for a bad id
✔ search and filters narrow the medicine list
✔ customer requires an ID number for a senior discount
✔ categories and suppliers are suggested from what is already in use
✔ the last active owner cannot be deactivated or given a branch
✔ stock filter finds medicines with expiring and expired lots
✔ receiving stock creates a batch and a ledger entry
✔ refuses to receive already-expired stock
✔ adjustment cannot push a batch below zero
✔ a manager cannot adjust another branch's batch
✔ alerts list expired, near-expiry and low-stock items
✔ sending stock moves units to the other branch in one step, keeping expiry dates
✔ sending stock fails (and moves nothing) when the branch lacks stock
✔ a branch manager cannot send stock from another branch
✔ a pharmacist can remove expired stock but not record a count correction
✔ owner alerts count shortages per branch, not combined stock
✔ an expired lot cannot be re-dated to make it sellable again
✔ a lot that has sold units can only have its expiry moved earlier
✔ a typo in a new, unsold lot's expiry can be fixed
✔ a second delivery of the same lot adds to it; a different expiry is refused
✔ a pharmacist is notified of a new prescription, and the cashier when it is checked
✔ cashiers get no stock or license notifications; pharmacists get stock ones
✔ a voided sale is shown to the owner but not to the manager who voided it
✔ cash summary adds up one person's sales for the day
✔ cash summary access: own day only for staff, own branch for managers
✔ cash sale deducts stock and computes VAT server-side
✔ FEFO: the earliest-expiring sellable batch is used first
✔ a sale larger than one batch is split across batches
✔ expired stock is never sold
✔ a failed sale rolls back completely
✔ insufficient cash is rejected
✔ prescription-only medicine needs a verified prescription
✔ prescription workflow: record, verify, dispense partially, then fully
✔ a cashier can record a prescription, but it waits for a pharmacist
✔ a pharmacist can save and verify a prescription in one step
✔ senior discount: VAT-exempt and 20% off
✔ discount is refused for a customer without a matching ID
✔ void returns stock to the original batches; only managers can void
✔ the owner has no till and cannot ring up sales
✔ dashboard and reports are computed from data
✔ a prescription older than 180 days cannot be verified
✔ a verified prescription that has since expired cannot be given out
ℹ tests 58
ℹ suites 0
ℹ pass 58
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5549.956458
```

## Browser checks

All three roles (and the owner) were signed in with headless Chrome. Every page they can reach, every Settings tab, every report, and the Medicines & Stock filters were loaded with no page errors and no failed API calls. These flows were run end to end:

- A pharmacist records a prescription for a new patient using the "New patient" quick-add, chooses **Save and verify**, opens **Print record** (it shows the verifying pharmacist's PRC license), and removes expired stock from a lot.
- A cashier opens Sell, chooses **Give out a checked prescription**, and the cart fills with the prescribed medicine.
- A manager adds a medicine with a new category typed in ("Herbal"; the existing categories are offered as suggestions), then receives a delivery of it with a new supplier typed in.
- Swagger UI at `/api-docs`: sign in with **Auth → Sign in**, then run `GET /medicines` as that user (200). The app pages keep their strict security policy.
- The owner sends 5 units from Main Branch to North Branch in one step (both branches' stock updates, and the lot and expiry date carry over), then adds a pharmacist account. The license fields appear only when the role is Pharmacist.

## Manual test checklist (final demo sequence)

| # | Demo step | How to show it | Expected |
|---|---|---|---|
| 1 | Problem and users | README introduction and the access table | |
| 2 | Architecture and ERD | `docs/ERD.md` and README "Project structure" | |
| 3 | Tables and relationships | phpMyAdmin → `pharmacy_pms` → Designer | 10 tables with foreign keys (plus the `sessions` table) |
| 4 | Create a record | Medicines & Stock → Add medicine | Toast; the row appears with 0 stock and "Out of stock" |
| 5 | Retrieve records | Medicines & Stock, open a row | Stock by expiry date, stock history |
| 6 | Update | Edit details → change the price | Toast; the new price shows in the list and at Sell |
| 7 | Delete or archive | Archive the medicine; also delete a pending prescription | Hidden from the list; visible with "Show archived" |
| 8 | Search and filter | Medicines & Stock: search "para", then the Running low / Expiring soon / Expired chips | The list narrows |
| 9 | Home | Sign in as `manager.main` | Figures match Reports → Sales summary |
| 10 | Additional features | Earliest-expiry-first at Sell, senior discount, Save and verify a prescription, Print record, Send to another branch, Print / CSV reports, void | |
| 11 | Frontend to REST API | DevTools → Network while completing a sale; then <http://localhost:3000/api-docs> (Swagger UI) | `POST /api/sales` → 201 JSON; every endpoint listed and runnable |
| 12 | Backend to MySQL | `src/config/db.js` (pool, `withTransaction`) and `src/services/checkoutService.js` | |
| 13 | Validation and errors | Submit an empty form; sell more than is in stock; cashier opens `/api/reports/daily-sales` | 400 with field messages; 409 "Only N in stock"; 403 |
| 14 | Tests and limitations | `npm test`, this file, README "Limitations" | 58 passing |
