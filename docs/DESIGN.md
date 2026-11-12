# Design direction

**Design read:** an internal operations tool for pharmacy counter staff on desktops and tablets. The visual language is calm, clinical, and close to Apple's interfaces.

**Dials:** ENERGY 1 (calm), RHYTHM 1 (uniform), MOTION 1 (functional only). Staff use this hundreds of times a day, so speed and legibility come before personality.

## Decisions and reasons

| Decision | Reason |
|---|---|
| System font stack (SF Pro on Apple, Segoe UI on Windows) | Familiar, crisp, no download. Headings use −0.02em tracking and 1.15 leading; body text uses 1.5 leading. |
| Tabular figures on all money and quantities | Columns of prices line up, and totals don't jitter while the cart changes. |
| One accent: pharmacy green `#0b7a5a` (dark theme `#2ea67d`) | It matches the domain. Red, amber, and green appear only to show status. |
| Expiry pill as the identity motif | The pill shows days left and the date, colored by urgency, and appears on every lot, Sell result, and alert. It is the most important fact in a pharmacy, so it gets the most consistent treatment. |
| Translucent material only on the sidebar and top bar | Structural chrome, as in Apple's materials. Every other surface is solid. With `prefers-reduced-transparency` or `prefers-contrast` turned on, the chrome becomes solid. |
| Shadows only on raised layers (dialogs, menus, toasts) | Shadow means elevation. Cards use a hairline border instead. |
| Radius scale 6 / 10 / 14px | Consistent nesting: controls 10px, panels 14px, pills 6px. |
| Light theme by default, dark theme follows the OS, manual switch in the account menu | Pharmacies are bright retail spaces. Dark mode helps on night shifts. The choice is saved per device. |
| Native `<dialog>` for every modal | Focus trapping, Escape to close, and an inert background come built in. |
| Confirmations only for destructive actions (void, archive, reject, cancel) | Following Apple's guidance, routine actions are not interrupted. |

## Contrast

Every text and background pair meets WCAG AA (4.5:1) in both themes. These were computed rather than estimated. The lowest pair is muted text on the page background in light mode, at 4.92:1. The chart accent passes the dataviz palette validator against both surfaces.

## Motion

Rules follow Emil Kowalski's design-engineering guidance.

| Element | Spec |
|---|---|
| Button press | `scale(0.97)` on `:active`, 160ms, `cubic-bezier(0.23, 1, 0.32, 1)` |
| Dialogs | Fade plus `scale(0.96 → 1)` from the center over 220ms; exit over 160ms (exits are faster than entrances). Built with `@starting-style`. |
| Menus and listboxes | 180ms, scaling from the trigger (`transform-origin` at the trigger) |
| Toasts | Slide up 8px over 250ms. The timer pauses while the tab is hidden or the pointer is over the toast. |
| Hover states | Only inside `@media (hover: hover) and (pointer: fine)`, so taps on tablets don't leave items stuck in a hover state |
| Not animated | POS keyboard actions (`/`, `F9`, arrows), cart updates, table refreshes, chart bars. These happen dozens of times an hour, and charts with financial data stay still. |
| Sign-in page | The one exception, since staff see it once per shift: a staggered rise-in (600ms), a slowly drifting gradient on the brand panel, a pointer spotlight on the card and a short shake after a failed sign-in. Styles live in `public/css/login.css`. |
| `prefers-reduced-motion` | Transforms are removed; opacity fades remain. |

Only `transform` and `opacity` are animated.

## Simplicity (version 2)

Version 1 had every feature a pharmacy could want, but pharmacists, managers and store staff found it hard to use. Version 2 keeps every function and removes the weight around it:

| Change | Reason |
|---|---|
| 8 menu items, no groups (cashiers see 6) | Fewer places to look. Pages that belonged together were merged: Medicines, Inventory (4 tabs) and Transfers became **Medicines & Stock**; Staff and Branches are the only tabs left in **Settings**; categories and suppliers are typed in where they are used, with suggestions. |
| Home starts with big buttons for the common jobs | New sale, Record a prescription, Receive delivery, Look up a medicine. Staff should not have to hunt through menus. |
| One "Needs attention" list | Expired, expiring soon and running low used to be three sections and two pages. Now it is one list, most urgent first. |
| Filter chips instead of dropdowns and tabs | All · Running low · Expiring soon · Expired · Out of stock, visible at once. |
| Plain words | "Lot" instead of "batch", "Remove expired stock" instead of "write off", "Shelf count is different" instead of "adjustment", "Give out" instead of "dispense", "Stock history" instead of "stock ledger". FEFO is never shown; the screen just says "Sell always uses the one that expires first." |
| Optional details are folded away | Receiving a delivery asks for 3 things (how many, expiry date, lot number). Supplier and cost sit under "More details (optional)". |
| One step instead of many | Sending stock to another branch is one form, not request → dispatch → receive. A pharmacist can **Save and verify** a prescription at once. A new patient can be added from inside the prescription form. |
| Larger text and controls | Base text is 16px and controls are 44px tall, easier to read and tap at a busy counter. |
| The 14-day chart was removed from Home | Counter staff did not use it. Managers get the same numbers in Reports → Sales summary, which can be printed. |

## Copy

- No em dashes, emoji, or hype.
- Labels name the action in everyday words: "New sale", "Receive delivery", "Remove expired", "Give out at Sell", "Save and verify".
- Empty states say what to do next.
- Error messages say what went wrong and how to fix it.

## Delivery gate (anti-slop)

| Check | Result | Evidence |
|---|---|---|
| No em dashes in UI copy | PASS | Searched `public/` |
| No invented statistics | PASS | Every dashboard and report figure comes from SQL over recorded data |
| No fake testimonials or people presented as real | PASS | Seed names, companies, addresses, and license numbers are marked as fictional samples |
| Every control works | PASS | A browser script exercised each page for all three roles and the owner; no console errors |
| Empty, loading, and error states | PASS | Built into the shared list component (skeleton, empty with next step, error with retry) and repeated in custom panels |
| Keyboard access and visible focus | PASS | `:focus-visible` ring on all controls. Tables rows open with Enter, tabs use arrow keys, comboboxes follow the ARIA 1.2 pattern, dialogs trap focus. |
| Contrast AA in both themes | PASS | See Contrast above |
| Tap targets ≥ 44px on touch | PASS | Controls are 44px tall. Nav items and checkboxes are 40 to 44px. |
| Both themes fully work | PASS | Checked with screenshots in light and dark |
| Glass limited to one or two surfaces | PASS | Sidebar and top bar only |
| One accent; status colors carry meaning only | PASS | |
| Decisions written down | PASS | This document |
| Security or performance claims | PASS | None are made beyond what is implemented and tested |
