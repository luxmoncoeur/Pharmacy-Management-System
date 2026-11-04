// Mirrors src/utils/pricing.js so the cart can preview totals instantly.
// The server recomputes everything at checkout; these numbers are for display only.
const VAT_RATE = 0.12;
const SENIOR_PWD_DISCOUNT = 0.2;

export function computeTotals(lines, discountType = 'none') {
  const subtotalCents = lines.reduce((sum, l) => sum + Math.round(l.unit_price * 100) * l.quantity, 0);
  const exclusiveCents = Math.round(subtotalCents / (1 + VAT_RATE));
  if (discountType === 'senior' || discountType === 'pwd') {
    const discountCents = Math.round(exclusiveCents * SENIOR_PWD_DISCOUNT);
    return { subtotal: subtotalCents / 100, vatable_amount: 0, vat_amount: 0, vat_exempt: exclusiveCents / 100, discount_amount: discountCents / 100, total: (exclusiveCents - discountCents) / 100 };
  }
  return { subtotal: subtotalCents / 100, vatable_amount: exclusiveCents / 100, vat_amount: (subtotalCents - exclusiveCents) / 100, vat_exempt: 0, discount_amount: 0, total: subtotalCents / 100 };
}
