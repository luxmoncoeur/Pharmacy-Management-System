import { RX_VALID_DAYS } from '../config/pricing.js';
import { phToday } from '../validators/common.js';
import { conflict } from './http.js';

/** Whole days between the date a prescription was written (YYYY-MM-DD) and today in Philippine time. */
export const rxAgeDays = (dateIssued) => Math.round((Date.parse(phToday()) - Date.parse(String(dateIssued).slice(0, 10))) / 86400000);

/** Prescriptions can be verified and given out only within RX_VALID_DAYS of the date written. */
export function assertRxValid(dateIssued) {
  const age = rxAgeDays(dateIssued);
  if (age > RX_VALID_DAYS) {
    throw conflict(`This prescription was written ${age} days ago. Prescriptions are valid for ${RX_VALID_DAYS} days. Ask for a new prescription.`, {
      date_issued: `Older than ${RX_VALID_DAYS} days.`,
    });
  }
}
