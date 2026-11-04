import { api } from '../api.js';
import { html } from '../dom.js';
import { icon } from '../icons.js';
import { money, dateTime, PAYMENT_LABELS, DISCOUNT_LABELS, statusPill } from '../format.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { toast, toastError } from '../ui/toast.js';
import { can, ROLES } from '../session.js';
import { dataChanged } from './shared.js';

export function receiptHtml(s) {
  return html`<article class="receipt" aria-label="Receipt ${s.receipt_no}">
    ${s.status === 'voided' ? html`<div class="void-stamp">VOIDED</div>` : ''}
    <header>
      <strong>${s.branch_name}</strong>
      <span>${s.branch_address}</span>
      ${s.branch_phone ? html`<span>Tel. ${s.branch_phone}</span>` : ''}
      <span class="small subtle">Sample business details. Replace with the pharmacy's registered TIN before real use.</span>
    </header>
    <div class="r-section">
      <div class="r-line"><span>Receipt no.</span><span class="mono">${s.receipt_no}</span></div>
      <div class="r-line"><span>Date</span><span>${dateTime(s.created_at)}</span></div>
      <div class="r-line"><span>Cashier</span><span>${s.cashier_name}</span></div>
      ${s.customer_name ? html`<div class="r-line"><span>Customer</span><span>${s.customer_name}</span></div>` : ''}
      ${s.prescription_id ? html`<div class="r-line"><span>Prescription</span><span>#${s.prescription_id}${s.doctor_name ? ` · ${s.doctor_name}` : ''}</span></div>` : ''}
    </div>
    <div class="r-section">
      ${s.items.map((i) => html`<div class="r-item">
        <div class="r-line"><span>${i.generic_name} ${i.strength}${i.requires_prescription ? ' (Rx)' : ''}</span><span>${money(i.line_total)}</span></div>
        <div class="r-detail">${i.quantity} × ${money(i.unit_price)} · ${i.brand}</div>
        <div class="r-detail">Lot ${i.batches}</div>
      </div>`)}
    </div>
    <div class="r-section">
      <div class="r-line"><span>Subtotal</span><span>${money(s.subtotal)}</span></div>
      ${s.discount_type !== 'none' ? html`
        <div class="r-line"><span>Less VAT (exempt)</span><span>−${money(s.subtotal - s.vat_exempt)}</span></div>
        <div class="r-line"><span>${DISCOUNT_LABELS[s.discount_type]} discount (20%)</span><span>−${money(s.discount_amount)}</span></div>
        <div class="r-line"><span>ID no.</span><span>${s.discount_id_no}</span></div>` : ''}
      <div class="r-line r-total"><span>Total</span><span>${money(s.total)}</span></div>
      <div class="r-line"><span>${PAYMENT_LABELS[s.payment_method]}${s.payment_ref ? ` (ref ${s.payment_ref})` : ''}</span><span>${money(s.amount_tendered)}</span></div>
      ${s.payment_method === 'cash' ? html`<div class="r-line"><span>Change</span><span>${money(s.change_due)}</span></div>` : ''}
    </div>
    <div class="r-section">
      <div class="r-line"><span>VATable sales</span><span>${money(s.vatable_amount)}</span></div>
      <div class="r-line"><span>VAT (12%)</span><span>${money(s.vat_amount)}</span></div>
      <div class="r-line"><span>VAT-exempt sales</span><span>${money(s.vat_exempt)}</span></div>
    </div>
    ${s.status === 'voided' ? html`<div class="r-section"><div>Voided by ${s.voided_by_name} on ${dateTime(s.voided_at)}</div><div>Reason: ${s.void_reason}</div></div>` : ''}
    <footer>Thank you. Keep this receipt for returns and warranty claims.</footer>
  </article>`;
}

/** Opens a sale's receipt. Managers get a Void action on completed sales. */
export async function openReceipt(saleOrId, { onVoid, footerExtra } = {}) {
  let sale = saleOrId;
  try {
    if (typeof saleOrId !== 'object') sale = (await api.get(`/sales/${saleOrId}`)).data;
  } catch (err) {
    toastError(err);
    return null;
  }
  const canVoid = can(...ROLES.MANAGEMENT) && sale.status === 'completed';
  const dlg = openDialog({
    title: html`Receipt ${statusPill(sale.status)}`,
    className: 'receipt-dialog',
    body: receiptHtml(sale),
    footer: html`
      ${canVoid ? html`<button class="btn btn-ghost" type="button" data-void>${icon('ban')}Void sale</button>` : ''}
      <span class="spacer"></span>
      ${footerExtra ?? ''}
      <button class="btn" type="button" data-print>${icon('printer')}Print</button>
      <button class="btn btn-primary" type="button" data-close autofocus>Done</button>`,
  });
  dlg.el.querySelector('[data-print]').addEventListener('click', () => window.print());
  dlg.el.querySelector('[data-void]')?.addEventListener('click', async () => {
    const done = await confirmDialog({
      title: `Void ${sale.receipt_no}?`,
      message: `This cancels the ${money(sale.total)} sale and puts every unit back on the shelf. The receipt stays on record, marked as voided.`,
      confirmLabel: 'Void this sale',
      danger: true,
      reasonLabel: 'Why is this sale being voided?',
      onConfirm: (reason) => api.post(`/sales/${sale.sale_id}/void`, { reason }),
    });
    if (done) {
      dlg.close();
      toast(`${sale.receipt_no} voided. Stock was returned.`);
      dataChanged();
      onVoid?.();
    }
  });
  return dlg;
}
