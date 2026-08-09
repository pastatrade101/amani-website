/**
 * Split legacy packed tour inclusion/exclusion rows.
 *
 * The importer historically used "|" as the list delimiter. A few source CSV
 * cells used semicolons instead, which created one very long child row such as
 * "Park fees; guide; lunch" instead of three rows. This script expands only
 * rows with multiple semicolon-delimited items.
 *
 * Dry run by default:
 *   npm run content:split-tour-lists
 *
 * Apply:
 *   npm run content:split-tour-lists -- --apply
 */
import { supabase } from '../config/supabase';

type TableName = 'tour_inclusions' | 'tour_exclusions';
type Row = {
  created_at?: string | null;
  id: string;
  sort_order?: number | null;
  title: string;
  tour_id: string;
  tours?: { slug?: string | null; title?: string | null } | { slug?: string | null; title?: string | null }[] | null;
};

const TABLES: TableName[] = ['tour_inclusions', 'tour_exclusions'];

const splitItems = (value: string): string[] =>
  value
    .split(';')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const tourLabel = (row: Row): string => {
  const tour = Array.isArray(row.tours) ? row.tours[0] : row.tours;
  const title = tour?.title || row.tour_id;
  const slug = tour?.slug ? ` (${tour.slug})` : '';
  return `${title}${slug}`;
};

const sortRows = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => {
    const bySort = Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
    if (bySort !== 0) return bySort;
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  });

const runTable = async (table: TableName, apply: boolean): Promise<number> => {
  const { data, error } = await supabase
    .from(table)
    .select('id,tour_id,title,sort_order,created_at,tours(title,slug)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`${table}: ${error.message}`);

  const rows = (data ?? []) as unknown as Row[];
  const affectedTourIds = new Set(
    rows.filter((row) => splitItems(row.title).length > 1).map((row) => row.tour_id)
  );

  console.log(`\n${table}: ${affectedTourIds.size} tour(s) with packed semicolon rows.`);
  if (!affectedTourIds.size) return 0;

  let packedRows = 0;

  for (const tourId of affectedTourIds) {
    const tourRows = sortRows(rows.filter((row) => row.tour_id === tourId));
    const first = tourRows[0];
    const expanded: string[] = [];

    console.log(`\n- ${tourLabel(first)}`);
    for (const row of tourRows) {
      const parts = splitItems(row.title);
      if (parts.length > 1) {
        packedRows += 1;
        console.log(`  split: "${row.title}"`);
        for (const part of parts) console.log(`     -> ${part}`);
        expanded.push(...parts);
      } else {
        expanded.push(row.title.replace(/\s+/g, ' ').trim());
      }
    }

    if (apply) {
      const { error: deleteError } = await supabase.from(table).delete().eq('tour_id', tourId);
      if (deleteError) throw new Error(`${table} ${tourId}: ${deleteError.message}`);

      const insertRows = expanded
        .filter(Boolean)
        .map((title, sort_order) => ({ tour_id: tourId, title, sort_order }));
      if (insertRows.length) {
        const { error: insertError } = await supabase.from(table).insert(insertRows);
        if (insertError) throw new Error(`${table} ${tourId}: ${insertError.message}`);
      }
      console.log(`  applied: rebuilt ${insertRows.length} row(s).`);
    }
  }

  return packedRows;
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  let total = 0;

  for (const table of TABLES) total += await runTable(table, apply);

  console.log(
    apply
      ? `\nDone. Split ${total} packed row(s).`
      : `\nDry run - nothing changed. ${total} packed row(s) would be split. Re-run with --apply to write changes.`
  );
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
