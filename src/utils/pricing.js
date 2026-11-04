import { VAT_RATE, SENIOR_PWD_DISCOUNT } from '../config/pricing.js';

const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => cents / 100;

/**
 * Computes receipt totals from cart lines. Works in integer cents to avoid float drift.
 * @param {{unit_price:number, quantity:number}[]} lines
 * @param {'none'|'senior'|'pwd'} discountType
 */
export function computeTotals(lines, discountType = 'none') {
  const subtotalCents = lines.reduce((sum, l) => sum + toCents(l.unit_price) * l.quantity, 0);
  const exclusiveCents = Math.round(subtotalCents / (1 + VAT_RATE));

  if (discountType === 'senior' || discountType === 'pwd') {
    const discountCents = Math.round(exclusiveCents * SENIOR_PWD_DISCOUNT);
    return {
      subtotal: fromCents(subtotalCents),
      vatable_amount: 0,
      vat_amount: 0,
      vat_exempt: fromCents(exclusiveCents),
      discount_amount: fromCents(discountCents),
      total: fromCents(exclusiveCents - discountCents),
    };
  }

  return {
    subtotal: fromCents(subtotalCents),
    vatable_amount: fromCents(exclusiveCents),
    vat_amount: fromCents(subtotalCents - exclusiveCents),
    vat_exempt: 0,
    discount_amount: 0,
    total: fromCents(subtotalCents),
  };
}

export const lineTotal = (unitPrice, quantity) => fromCents(toCents(unitPrice) * quantity);
