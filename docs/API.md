# API reference

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

`branch` filters by branch for **admins only**. Other roles are always limited to their own branch, whatever they send.

Roles: **A** admin, **M** manager, **P** pharmacist, **C** cashier.

## Auth

| Method | Path | Roles | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ username, password }` → user. Rate limited. |
| POST | `/auth/logout` | any | Ends the session. |
| GET | `/auth/me` | any | Current user with `role`, `branch_id`, `branch_name`, `pharmacist_id`. |
| PATCH | `/auth/me/password` | any | `{ current_password, new_password }`. The new password needs 8+ characters with a letter and a number. |

## Branches

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/branches` | any | Active branches. Admins can add `?status=all`. |
| GET | `/branches/:id` | any | |
| POST | `/branches` | A | `{ name, address, phone? }` |
| PUT | `/branches/:id` | A | Same body as POST, plus `is_active`. |
| DELETE | `/branches/:id` | A | Deactivates. Returns 409 while the branch has active staff. |

## Staff accounts

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/users` | A, M | `q, role, branch, status=active\|inactive\|all`; `sort: username, full_name, role, last_login_at`. Managers see only their branch. |
| GET | `/users/:id` | A, M | |
| POST | `/users` | A | `{ username, full_name, role, branch_id (required unless admin), password }` |
| PUT | `/users/:id` | A | Same body as POST. `password` is optional and resets it when given. Keeps at least one active admin (409). |
| DELETE | `/users/:id` | A | Deactivates. The user is signed out on their next request. |

## Pharmacists

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/pharmacists` | A, M | `q, status`. Includes `license_days_left`. |
| GET | `/pharmacists/:id` | A, M | |
| POST | `/pharmacists` | A | `{ firstname, lastname, license_no, license_expiry, email?, phone?, user_id? }`. `user_id` must be a pharmacist account. |
| PUT | `/pharmacists/:id` | A | Same body as POST, plus `is_active`. |
| DELETE | `/pharmacists/:id` | A | Deactivates. |

## Customers

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/customers` | any | `q` (name, phone, email, ID no.), `discount=none\|senior\|pwd`, `status`; `sort: lastname, firstname, created_at` |
| GET | `/customers/:id` | any | Includes computed `age`. |
| GET | `/customers/:id/history` | any | `{ sales: [...], prescriptions: [...] }` for your branch. |
| POST | `/customers` | any | `{ firstname, lastname, birthdate?, phone?, email?, address?, discount_id_type, discount_id_no? }`. `discount_id_no` is required when the type is `senior` or `pwd`. |
| PUT | `/customers/:id` | any | Same body as POST, plus `is_active`. |
| DELETE | `/customers/:id` | A, M, P | Archives the customer. Their history is kept. |

## Categories and suppliers

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/categories` | any | Includes `medicine_count`. |
| POST / PUT | `/categories`, `/categories/:id` | A, M | `{ name }` |
| DELETE | `/categories/:id` | A, M | Returns 409 while medicines use the category. |
| GET | `/suppliers` | any | `status` |
| GET | `/suppliers/:id` | any | |
| POST / PUT | `/suppliers`, `/suppliers/:id` | A, M | `{ name, contact_person?, phone?, email?, address? }` |
| DELETE | `/suppliers/:id` | A, M | Deactivates. |

## Medicines

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/medicines` | any | `q` (name, brand, exact barcode), `category`, `rx=rx\|otc`, `stock=in\|low\|out`, `status`, `branch`; `sort: generic_name, brand, price, stock_on_hand, nearest_expiry`. Each row includes `stock_on_hand` (sellable), `expired_qty`, `nearest_expiry`, `days_to_expiry`, and `stock_status` for your branch. |
| GET | `/medicines/:id` | any | Also returns `branches: [{ branch_name, sellable, expired_qty }]`. |
| GET | `/medicines/barcode/:code` | any | Exact barcode lookup. |
| POST | `/medicines` | A, M | `{ generic_name, brand, category_id, dosage_form, strength, unit, price, requires_prescription, reorder_level, barcode? }` |
| PUT | `/medicines/:id` | A, M | Same body as POST, plus `is_active`. Price changes are written to the audit log. |
| DELETE | `/medicines/:id` | A, M | Archives the medicine and hides it from the POS. |

## Inventory

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/batches` | any | `q, medicine, branch, expiry=expired\|near\|ok, in_stock=true`; `sort: expiry_date, qty_on_hand, received_at, generic_name` |
| GET | `/batches/:id` | any | Own branch only. |
| POST | `/batches` | A, M, P | **Receive stock.** `{ medicine_id, batch_no, expiry_date (future), quantity, cost_price, supplier_id?, branch_id (admin only) }`. Creates the batch and a `receive` ledger entry. |
| PATCH | `/batches/:id` | A, M | Corrects details: `{ batch_no, expiry_date, cost_price, supplier_id? }`. Quantity cannot change here. |
| POST | `/batches/:id/adjust` | A, M | `{ type: adjust\|write_off, qty_change (signed, non-zero), reason }`. Returns 409 if the quantity would go below zero. |
| GET | `/inventory/alerts` | any | `{ low_stock, near_expiry, expired, near_expiry_days }` |
| GET | `/inventory/reorder` | A, M, P | Medicines at or below their reorder level, with `sold_30d` and `suggested_qty`. |
| GET | `/inventory/movements` | A, M | The stock ledger. `type, medicine, batch, branch, from, to` |

## Prescriptions

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/prescriptions` | any | `q, status=pending\|verified\|partially_dispensed\|dispensed\|rejected\|dispensable, customer, branch` |
| GET | `/prescriptions/:id` | any | Includes `items` with `remaining` and branch `stock_on_hand`. |
| POST | `/prescriptions` | A, M, P | `{ customer_id, doctor_name, doctor_license_no, date_issued (not in the future), notes?, items: [{ medicine_id, quantity, instructions? }] }`. Starts as `pending`. |
| PUT | `/prescriptions/:id` | A, M, P | Only while `pending`. |
| DELETE | `/prescriptions/:id` | A, M, P | Only while `pending`. Reviewed prescriptions are permanent records. |
| POST | `/prescriptions/:id/verify` | P | Requires the account to be linked to a pharmacist record. Sets the status to `verified`. |
| POST | `/prescriptions/:id/reject` | P | `{ reason }` |

## Sales

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/sales` | any | `q, status, payment, customer, cashier, from, to, branch`; `sort: created_at, total, receipt_no`. `meta.revenue` is the total of completed sales in the result. Cashiers see only their own sales. |
| GET | `/sales/:id` | any | Full receipt: header, totals, and `items` with the batches drawn. |
| POST | `/sales` | M, P, C | **Checkout.** Details below. |
| POST | `/sales/:id/void` | A, M | `{ reason }`. Returns stock to its batches and reopens prescription quantities. |

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
- Rx medicines require a `prescription_id` that is `verified` or `partially_dispensed`, from the same branch, for the same customer, with enough quantity remaining.
- `discount_type` other than `none` requires a customer whose ID on file matches.
- Stock is taken earliest-expiry first from batches that have not expired. A shortage returns 409 with `errors["items.N"]`.
- Totals are computed on the server and client totals are ignored. Cash must cover the total. GCash and card require `payment_ref`.
- Any failure rolls back everything.

## Transfers

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/transfers` | A, M | `status, branch` |
| GET | `/transfers/:id` | A, M | Only if your branch is the sender or receiver. |
| POST | `/transfers` | A, M | `{ from_branch_id, to_branch_id, notes?, items: [{ medicine_id, quantity }] }`. Must involve your branch. |
| POST | `/transfers/:id/dispatch` | A, M (sender) | Picks batches by FEFO and removes the stock from the sender. |
| POST | `/transfers/:id/receive` | A, M (receiver) | Adds the stock to the receiver with the same batch number and expiry. |
| POST | `/transfers/:id/cancel` | A, M (either branch) | Works on requested or in-transit transfers. Stock in transit returns to the sender. |

## Dashboard, reports, audit

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/dashboard` | any | Today's sales, a 14-day series, top sellers, stock and expiry counts, prescriptions, transfers, recent sales. Admins also get a per-branch table. Admins and managers also get license alerts. |
| GET | `/reports/:name` | A, M | `name` is one of `daily-sales`, `sales-by-medicine`, `stock-status`, `expiring`, `branch-summary`. Parameters: `from, to, days, branch, format=json\|csv`. |
| GET | `/audit-log` | A | `user, entity, action, from, to` |
