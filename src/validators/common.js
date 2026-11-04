import { z } from 'zod';

const blankToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const requiredText = (label, max = 120) =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} must be at most ${max} characters.`);

export const optionalText = (label, max = 255) =>
  z.preprocess(blankToNull, z.string().trim().max(max, `${label} must be at most ${max} characters.`).nullable().optional());

export const optionalEmail = z.preprocess(blankToNull, z.email('Enter a valid email address.').max(120).nullable().optional());

export const optionalPhone = z.preprocess(
  blankToNull,
  z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, 'Enter a valid phone number (digits, spaces or dashes).').nullable().optional(),
);

export const isoDate = (label) =>
  z.string({ error: `${label} is required.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`)
    .refine((s) => !Number.isNaN(Date.parse(s)), `${label} must be a valid date.`);

export const optionalDate = (label) => z.preprocess(blankToNull, isoDate(label).nullable().optional());

export const id = (label = 'ID') => z.coerce.number({ error: `${label} must be a number.` }).int().positive(`${label} is required.`);
export const optionalId = (label) => z.preprocess(blankToNull, id(label).nullable().optional());

export const money = (label) =>
  z.coerce.number({ error: `${label} must be a number.` }).nonnegative(`${label} cannot be negative.`).max(9999999, `${label} is too large.`)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, `${label} can have at most 2 decimal places.`)
    .transform((n) => Math.round(n * 100) / 100);

export const qty = (label = 'Quantity') =>
  z.coerce.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).positive(`${label} must be at least 1.`).max(100000, `${label} is too large.`);

export const bool = z.union([z.boolean(), z.enum(['true', 'false', '1', '0']), z.literal(1), z.literal(0)])
  .transform((v) => v === true || v === 'true' || v === '1' || v === 1);

export const idParams = z.object({ id: id() });

export const listQuery = (sortable, extra = {}) => z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.enum(sortable).optional(),
  dir: z.enum(['asc', 'desc']).default('asc'),
  ...extra,
});

export const activeFilter = z.enum(['active', 'inactive', 'all']).default('active');
export { z };
