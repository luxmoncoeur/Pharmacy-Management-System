/** Builds LIMIT/OFFSET and the meta block from validated page/limit query values. */
export function paginate({ page = 1, limit = 25 }) {
  return { limit, offset: (page - 1) * limit, page };
}

export const pageMeta = ({ page, limit }, total) => ({
  page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
});
