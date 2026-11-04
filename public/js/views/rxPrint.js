// Printable prescription record: everything an inspector, doctor or patient may ask to see,
// on one page: who prescribed what, which pharmacist checked it, and what was given out.
import { html } from '../dom.js';
import { icon } from '../icons.js';
import { date, dateTime, money, num, statusPill } from '../format.js';
import { openDialog } from '../ui/dialog.js';

export function prescriptionRecordHtml(rx) {
  return html`<article class="rx-record" aria-label="Prescription record #${rx.prescription_id}">
    <header class="rx-head">
      <div><strong>${rx.branch_name}</strong><span>${rx.branch_address ?? ''}</span>${rx.branch_phone ? html`<span>Tel. ${rx.branch_phone}</span>` : ''}</div>
      <div class="rx-title"><span>Prescription record</span><strong class="mono">#${rx.prescription_id}</strong>${statusPill(rx.status)}</div>
    </header>

    <div class="rx-grid">
      <section><h4>Patient</h4><p><strong>${rx.customer_name}</strong>${rx.customer_phone ? html`<br>${rx.customer_phone}` : ''}</p></section>
      <section><h4>Prescribing doctor</h4><p><strong>${rx.doctor_name}</strong><br>PRC license ${rx.doctor_license_no}</p></section>
      <section><h4>Date written</h4><p>${date(rx.date_issued)}</p></section>
      <section><h4>Recorded</h4><p>${dateTime(rx.created_at)}<br>by ${rx.created_by_name}</p></section>
    </div>

    <table class="rx-table">
      <thead><tr><th>Medicine</th><th>Instructions</th><th class="num">Prescribed</th><th class="num">Given out</th></tr></thead>
      <tbody>${rx.items.map((i) => html`<tr>
        <td><strong>${i.generic_name} ${i.strength}</strong><br><span class="small">${i.brand} · ${i.dosage_form}</span></td>
        <td>${i.instructions ?? 'None written'}</td>
        <td class="num">${num(i.quantity)}</td>
        <td class="num">${num(i.qty_dispensed)}</td></tr>`)}</tbody>
    </table>
    ${rx.notes ? html`<p class="small"><strong>Notes:</strong> ${rx.notes}</p>` : ''}

    <section class="rx-review">
      <h4>Pharmacist check</h4>
      ${rx.reviewed_at ? html`<p>${rx.status === 'rejected' ? 'Rejected' : 'Verified'} by <strong>${rx.pharmacist_name}</strong>${rx.pharmacist_license_no ? html`, PRC license ${rx.pharmacist_license_no}` : ''}, on ${dateTime(rx.reviewed_at)}.</p>
        ${rx.status === 'rejected' ? html`<p>Reason: ${rx.rejection_reason}</p>` : ''}`
        : html`<p>Not checked yet. This prescription cannot be given out until a pharmacist verifies it.</p>`}
    </section>

    <section>
      <h4>Given out</h4>
      ${rx.sales?.length ? html`<table class="rx-table">
        <thead><tr><th>Date</th><th>Receipt</th><th>By</th><th class="num">Amount</th></tr></thead>
        <tbody>${rx.sales.map((s) => html`<tr><td>${dateTime(s.created_at)}</td><td class="mono">${s.receipt_no}${s.status === 'voided' ? ' (cancelled)' : ''}</td><td>${s.cashier_name}</td><td class="num">${money(s.total)}</td></tr>`)}</tbody>
      </table>` : html`<p>Nothing given out yet.</p>`}
    </section>

    <footer class="rx-sign">
      <div><span></span>Pharmacist's signature</div>
      <div><span></span>Date</div>
    </footer>
  </article>`;
}

export function openPrescriptionRecord(rx) {
  const dlg = openDialog({
    title: `Prescription record #${rx.prescription_id}`,
    description: 'Show or print this when the patient, a doctor or an inspector asks for it.',
    className: 'rx-print-dialog',
    size: 'wide',
    body: prescriptionRecordHtml(rx),
    footer: html`<span class="spacer"></span>
      <button class="btn" type="button" data-close>Close</button>
      <button class="btn btn-primary" type="button" data-print autofocus>${icon('printer')}Print</button>`,
  });
  dlg.el.querySelector('[data-print]').addEventListener('click', () => window.print());
  return dlg;
}
