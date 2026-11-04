/** Official receipt number: branch and sale id, e.g. OR-01-000123. Unique because sale_id is. */
export const receiptNo = (branchId, saleId) => `OR-${String(branchId).padStart(2, '0')}-${String(saleId).padStart(6, '0')}`;
