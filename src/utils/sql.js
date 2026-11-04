// A batch is sellable only while its expiry date is still in the future.
export const SELLABLE = 'b.expiry_date > CURDATE()';

/** Collects WHERE fragments and their parameters so optional filters stay parameterized. */
export function where() {
  const parts = [];
  const params = [];
  return {
    add(sql, ...values) { parts.push(sql); params.push(...values); return this; },
    if(condition, sql, ...values) { if (condition !== undefined && condition !== null && condition !== '') this.add(sql, ...values); return this; },
    get sql() { return parts.length ? `WHERE ${parts.join(' AND ')}` : ''; },
    params,
  };
}

export const like = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Turns a whitelisted sort key into ORDER BY. Keys come from a zod enum, never from raw input. */
export const orderBy = (columns, sort, dir, fallback) => {
  const column = columns[sort] ?? fallback;
  return `ORDER BY ${column} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
};
