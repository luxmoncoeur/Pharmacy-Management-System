# API reference

**Interactive version:** start the server and open <http://localhost:3000/api-docs> (Swagger UI). Sign in with **Auth → Sign in**, then try any request. The raw OpenAPI file is at `/api-docs/openapi.json`, defined in `src/docs/openapi.js`.

Base URL: `http://localhost:3000/api`. All bodies are JSON. Every endpoint except sign-in requires a session cookie, which is set by `POST /auth/login`.

## Response format

Success:

```json
{ "success": true, "message": "Medicine added.", "data": { }, "meta": { "page": 1, "limit": 25, "total": 40, "pages": 2 } }
```

`meta` appears only on paginated lists.

Error:

```json
{ "success": false, "message": "Some fields need attention.", "errors": { "price": "Price must be greater than zero." } }
```

`errors` maps a field name to a message. For cart lines and prescription items, the key is the index, for example `items.0`.

| Status | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Validation failed, malformed JSON, or a linked record does not exist |
| 401 | Not signed in, wrong credentials, or account deactivated |
| 403 | Your role or branch cannot do this, or a cross-site request was blocked |
| 404 | Record or route not found |
| 409 | Conflict: duplicate value, not enough stock, wrong status for the action, or record in use |
| 429 | Too many failed sign-in attempts (10 per 15 minutes) |
| 500 | Unexpected server error. Details are logged on the server and never sent to the client. |

## Common list parameters

Paginated lists accept `page` (default 1), `limit` (default 25, max 200), `sort`, and `dir` (`asc` or `desc`). Each list's `sort` accepts only the keys listed for it. Any other value returns 400.

`branch` filters by branch for **the owner only**. Everyone else is always limited to their own branch, whatever they send.

Roles: **O** owner (a manager with no branch), **M** manager (any manager, including the owner), **P** pharmacist, **C** cashier. Everyone except the owner is limited to their own branch.

## Auth

| Method | Path | Roles | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ username, password }` → user. Rate limited. |
| POST | `/auth/logout` | any | Ends the session. |
| GET | `/auth/me` | any | Current user with `role`, `branch_id`, `branch_name`, `license_no`, `license_expiry`, `is_owner`. |
| PATCH | `/auth/me/password` | any | `{ current_password, new_password }`. The new password needs 8+ characters with a letter and a number. |

## Branches

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/branches` | any | Active branches. The owner can add `?status=all`. |
| GET | `/branches/:id` | any | |
| POST | `/branches` | O | `{ name, address, phone? }` |
| PUT | `/branches/:id` | O | Same body as POST, plus `is_active`. |
| DELETE | `/branches/:id` | O | Deactivates. Returns 409 while the branch has active staff. |

## Staff accounts

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/users` | M | `q, role, branch, status=active\|inactive\|all`. Branch managers see only their branch. Includes `license_no`, `license_expiry`, `license_days_left`. |
| GET | `/users/:id` | M | |
| POST | `/users` | O | `{ username, full_name, role: manager\|pharmacist\|cashier, branch_id, license_no, license_expiry, password }`. `branch_id` is required unless the role is `manager` (no branch = owner). `license_no` and `license_expiry` are required for pharmacists. |
| PUT | `/users/:id` | O | Same body as POST. `password` is optional and resets it when given. Keeps at least one active owner (409). |
| DELETE | `/users/:id` | O | Deactivates. The user is signed out on their next request. |

## Customers

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/customers` | any | `q` (name, phone, ID no.), `discount=none\|senior\|pwd`, `status`; `sort: lastname, firstname, created_at` |
| GET | `/customers/:id` | any | |
| GET | `/customers/:id/history` | any | `{ sales: [...], prescriptions: [...] }` for your branch. |
| POST | `/customers` | any | `{ firstname, lastname, phone?, discount_id_type, discount_id_no? }`. `discount_id_no` is required when the type is `senior` or `pwd`. |
| PUT | `/customers/:id` | any | Same body as POST, plus `is_active`. |
| DELETE | `/customers/:id` | M, P | Archives the customer. Their history is kept. |

## Category and supplier suggestions

Categories and suppliers are plain text on medicines and lots. These lists feed the suggestions shown while typing.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/categories` | any | `[{ name, medicine_count }]` for categories in use. |
| GET | `/suppliers` | any | `[{ name, delivery_count }]` for suppliers on past deliveries. |

## Medicines

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/medicines` | any | `q` (name, brand, exact barcode), `category` (name), `rx=rx\|otc`, `stock=in\|low\|out\|expiring\|expired`, `status`, `branch`; `sort: generic_name, brand, price, stock_on_hand, nearest_expiry`. Each row includes `stock_on_hand` (sellable), `expiring_qty`, `expired_qty`, `nearest_expiry`, `days_to_expiry` and `stock_status`. |
| GET | `/medicines/:id` | any | Also returns `branches: [{ branch_id, branch_name, sellable, expired_qty }]`. |
| GET | `/medicines/barcode/:code` | any | Exact barcode lookup. |
| POST | `/medicines` | M | `{ generic_name, brand, category, dosage_form, strength, unit, price, requires_prescription, reorder_level, barcode? }` |
| PUT | `/medicines/:id` | M | Same body as POST, plus `is_active`. |
| DELETE | `/medicines/:id` | M | Archives the medicine and hides it from Sell. |

## Stock (lots)

Every unit of stock belongs to a lot (a `batch` in the database) with a lot number and an expiry date.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/batches` | any | `q, medicine, branch, expiry=expired\|near\|ok, in_stock=true`; `sort: expiry_date, qty_on_hand, received_at, generic_name` |
| GET | `/batches/:id` | any | Own branch only. |
| POST | `/batches` | M, P | **Receive a delivery.** `{ medicine_id, batch_no, expiry_date (future), quantity, cost_price?, supplier?, branch_id (owner only) }`. `cost_price` defaults to 0. If the same lot number is already on file at the branch with the **same** expiry, the units are added to that lot (200, not 201). With a **different** expiry it returns 409 on `batch_no`. |
| PATCH | `/batches/:id` | M | Fixes lot details: `{ batch_no, expiry_date, cost_price, supplier? }`. Quantity cannot change here. A changed expiry must be in the future. An expired lot cannot be re-dated, and once units from a lot are sold its expiry can only move earlier (409). |
| POST | `/batches/:id/adjust` | M, P | `{ type, qty_change, reason }`. `type: write_off` removes expired or damaged stock (negative `qty_change`, allowed for pharmacists). `type: adjust` is a count correction (signed, managers only). Returns 409 if the lot would go below zero. |
| GET | `/inventory/alerts` | any | `{ low_stock, near_expiry, expired, near_expiry_days }` |
| GET | `/inventory/reorder` | M, P | Medicines at or below their reorder level, with `sold_30d` and `suggested_qty`. |
| GET | `/inventory/movements` | M, P | Stock history. `type, medicine, batch, branch, from, to` |

## Prescriptions

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/prescriptions` | any | `q, status=pending\|verified\|partially_dispensed\|dispensed\|rejected\|dispensable, customer, branch` |
| GET | `/prescriptions/:id` | any | The full record used for the printable copy: patient, doctor, `items` (with `remaining` and branch `stock_on_hand`), the verifying pharmacist's name and `pharmacist_license_no`, and `sales` (each sale that gave out medicine). |
| POST | `/prescriptions` | any | `{ customer_id, doctor_name, doctor_license_no, date_issued (not in the future), notes?, verify?, items: [{ medicine_id, quantity, instructions? }] }`. Starts as `pending`. With `verify: true` a pharmacist saves and verifies it in one step (403 for other roles). Records include `days_since_issued` and `is_expired`. |
| PUT | `/prescriptions/:id` | any | Only while `pending`. |
| DELETE | `/prescriptions/:id` | any | Only while `pending`. Reviewed prescriptions are permanent records. |
| POST | `/prescriptions/:id/verify` | P | Needs a pharmacist account with a PRC license that has not expired. Sets the status to `verified`. |

Prescriptions are valid for **180 days** from `date_issued` (`RX_VALID_DAYS` in `src/config/pricing.js`). An older one can still be recorded and rejected, but verifying it (including `verify: true`) or giving it out at checkout returns 409, and `status=dispensable` leaves it out.
| POST | `/prescriptions/:id/reject` | P | `{ reason }` |

## Sales

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/sales` | any | `q, status, payment, customer, cashier, from, to, branch`; `sort: created_at, total, receipt_no`. `meta.revenue` is the total of completed sales in the result. Cashiers see only their own sales. |
| GET | `/sales/:id` | any | Full receipt: header, totals, and `items` with the lots drawn. |
| POST | `/sales` | any with a branch | **Checkout.** Details below. The owner has no branch and cannot sell. |
| POST | `/sales/:id/void` | M | `{ reason }`. Returns stock to its lots and reopens prescription quantities. |

### Checkout

```json
{
  "items": [{ "medicine_id": 14, "quantity": 30 }],
  "customer_id": 2,
  "prescription_id": 23,
  "discount_type": "senior",
  "payment_method": "cash",
  "amount_tendered": 800,
  "payment_ref": null
}
```

Rules, all enforced in one transaction:
- Rx medicines require a `prescription_id` that is `verified` or `partially_dispensed`, from the same branch, for the same customer, written within the last 180 days, with enough quantity remaining.
- `discount_type` other than `none` requires a customer whose ID on file matches.
- Stock is taken earliest-expiry first from lots that have not expired. A shortage returns 409 with `errors["items.N"]`.
- Totals are computed on the server and client totals are ignored. Cash must cover the total. GCash and card require `payment_ref`.
- Any failure rolls back everything.

## Sending stock to another branch

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/transfers` | M | `{ to_branch_id, from_branch_id (owner only), notes?, items: [{ medicine_id, quantity }] }`. **One step:** stock leaves the sending branch (earliest expiry first) and arrives at the receiving branch with the same lot number and expiry. Returns `{ from_branch_id, to_branch_id, lots: [...] }`. Returns 409 and moves nothing if stock is short. There is no transfer table: each move shows in stock history (`GET /inventory/movements`) as `transfer_out` and `transfer_in`, with `ref_type = branch`. |

## Home and reports

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/dashboard` | any | Today's and yesterday's sales, best sellers this week, stock and expiry counts, prescriptions to check and ready, recent sales. Managers also get `license_alerts`; the owner viewing all branches also gets `branches`. |
| GET | `/notifications` | any | What needs this person's attention, built from existing data (no table of its own). `branch` (owner only). `data` is a list of `{ id, type, severity, title, body, link, at }`, newest first. `meta.counts` is `{ prescriptions, stock }` for the sidebar. Types by role: `rx_pending` (pharmacists, managers); `rx_reviewed` (the person who recorded a prescription someone else checked, last 3 days); `sale_voided` (managers, voids by someone else, last 3 days); `stock_expired`, `stock_out`, `stock_low`, `stock_expiring` and `license` (managers; pharmacists get the stock ones). Read/unread is kept by the browser. |
| GET | `/cash/summary` | any | End-of-day totals for one person and one day: `transactions, total, cash_count, cash, gcash, card, voided_count, voided_total, first_sale_at, last_sale_at, person`. `cashier` (defaults to you; required for the owner), `date` (defaults to today; past days and other people are for managers, own branch only). The cash count itself is printed, not stored. |
| GET | `/reports/:name` | M | `name` is one of `daily-sales` (Sales summary), `sales-by-medicine` (Best-selling medicines), `stock-status` (Stock and expiry). Parameters: `from, to, branch, format=json\|csv`. |
