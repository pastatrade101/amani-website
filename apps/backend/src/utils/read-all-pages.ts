type Page<T> = { data: T[] | null; count: number | null; error: unknown };

/** Follow the actual returned count, even when PostgREST caps a requested page. */
export const readAllPages = async <T>(
  read: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 500
): Promise<T[]> => {
  const rows: T[] = [];
  for (;;) {
    const result = await read(rows.length, rows.length + pageSize - 1);
    if (result.error) throw new Error('Unable to read complete sitemap inventory.', { cause: result.error });
    if (result.count === null) throw new Error('Sitemap inventory did not include an exact count.');
    const batch = result.data ?? [];
    rows.push(...batch);
    if (rows.length >= result.count) return rows;
    if (!batch.length) throw new Error('Sitemap inventory ended before all records were read.');
  }
};
