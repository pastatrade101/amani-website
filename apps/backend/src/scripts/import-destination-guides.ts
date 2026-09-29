/**
 * Load the long-form destination guide from the CMS content export into
 * destinations.guide.
 *
 * The generic CSV importer cannot carry this: `guide` is a jsonb array of
 * content blocks, not a text column, so the export's quick facts, section
 * headings and body paragraphs had nowhere to land and only the opening
 * paragraph made it in (as `description`). This reads the same export and
 * builds the blocks directly.
 *
 * Expects the destination-content export: one row per content item, with
 *   destination_id, destination_name, url, item_type, title, detail
 * where item_type is quick_fact | heading | paragraph | faq | list_item.
 *
 * FAQs are skipped — they already import into the `faqs` table and render in
 * their own section, so repeating them here would duplicate the page.
 *
 * Dry run by default:
 *   npm run content:destination-guides -- "/path/to/goldfinch-destination-content.csv"
 * Add --apply to write:
 *   npm run content:destination-guides -- "/path/to/file.csv" --apply
 */
import { readFileSync } from 'fs';
import { supabase } from '../config/supabase';

type Row = Record<string, string>;
type Block = { title: string; body?: string; items?: { title: string; body: string }[] };

const slugify = (value: string): string =>
  value.toString().toLowerCase().trim().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

// RFC-4180-ish, matching the parser the CSV importers already use.
const parseCsv = (text: string): Row[] => {
  const s = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n') { record.push(field); rows.push(record); record = []; field = ''; }
    else field += c;
  }
  if (field.length || record.length) { record.push(field); rows.push(record); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
};

const decode = (v: string) =>
  v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/ /g, ' ').trim();

// These two duplicate sections the destination page already renders from live
// data (its own tour list, and its own enquiry CTA), so they are not repeated
// inside the guide.
const isRedundantHeading = (heading: string) =>
  /^(recommended|plan your)\b/i.test(heading);

// The export uses a short full-sentence heading as a sub-heading inside the
// routing section. It reads as a pull-quote rather than a section of its own,
// so its paragraphs are folded into the block above it.
const isSubHeading = (heading: string) => heading.length < 60 && /[.!?]$/.test(heading);

const buildGuide = (rows: Row[]): Block[] => {
  const facts: { title: string; body: string }[] = [];
  const blocks: Block[] = [];
  let current: Block | null = null;
  let seenHeading = false;

  for (const row of rows) {
    const type = row.item_type;
    const title = decode(row.title);
    const detail = decode(row.detail);

    if (type === 'quick_fact') {
      if (title) facts.push({ title, body: detail });
    } else if (type === 'heading') {
      seenHeading = true;
      if (!title || isRedundantHeading(title)) { current = null; continue; }
      if (isSubHeading(title) && blocks.length) {
        // fold into the previous block rather than opening a new one
        current = blocks[blocks.length - 1];
        continue;
      }
      current = { title, body: '' };
      blocks.push(current);
    } else if (type === 'paragraph') {
      // Paragraphs before the first heading are the intro and the trust-chip
      // line; both already live on the destination record.
      if (!seenHeading || !current || !title) continue;
      current.body = current.body ? `${current.body}\n\n${title}` : title;
    }
    // faq and list_item are intentionally ignored (see file header).
  }

  const content = blocks.filter((b) => (b.body ?? '').trim());
  // The destination page renders at most 6 blocks, so lead with the facts and
  // keep the five strongest sections rather than letting the tail be truncated
  // arbitrarily.
  const out: Block[] = [];
  if (facts.length) out.push({ title: 'At a glance', items: facts });
  out.push(...content.slice(0, 6 - out.length));
  return out;
};

const run = async () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run content:destination-guides -- "<destination-content.csv>" [--apply]');
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(file, 'utf8'));
  const byDestination = new Map<string, Row[]>();
  for (const row of rows) {
    const id = row.destination_id;
    if (!id) continue;
    if (!byDestination.has(id)) byDestination.set(id, []);
    byDestination.get(id)!.push(row);
  }
  console.log(`parsed ${rows.length} content rows across ${byDestination.size} destinations\n`);

  let updated = 0;
  let missing = 0;
  let empty = 0;

  for (const [id, items] of byDestination) {
    const slug = slugify(id);
    const guide = buildGuide(items);
    const name = decode(items[0]?.destination_name || id);

    const { data: destination } = await supabase
      .from('destinations')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (!destination) {
      console.log(`  –  ${name} (${slug}) — no destination record, skipped`);
      missing += 1;
      continue;
    }
    if (!guide.length) {
      console.log(`  –  ${name} — nothing to import`);
      empty += 1;
      continue;
    }

    const words = guide.reduce((n, b) => n + (b.body ?? '').split(/\s+/).filter(Boolean).length, 0);
    const factCount = guide[0]?.items?.length ?? 0;
    console.log(`  ✓  ${name.padEnd(28)} ${guide.length} blocks, ${factCount} quick facts, ${words} words`);
    console.log(`       ${guide.map((b) => b.title).join(' · ')}`);

    if (apply) {
      const { error } = await supabase.from('destinations').update({ guide }).eq('id', destination.id);
      if (error) throw new Error(`${slug}: ${error.message}`);
    }
    updated += 1;
  }

  console.log(
    apply
      ? `\nDone. Wrote guides for ${updated} destination(s).` +
        (missing ? ` ${missing} had no matching record.` : '') +
        '\nThe public site caches destination data for 5 minutes.'
      : `\nDry run — nothing written. ${updated} destination(s) would get a guide` +
        (missing ? `, ${missing} have no matching record` : '') +
        (empty ? `, ${empty} had no usable content` : '') +
        '.\nRe-run with --apply to write.'
  );
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
