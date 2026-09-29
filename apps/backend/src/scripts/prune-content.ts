/**
 * Prune CMS content back to the canonical import set.
 *
 * A CSV import only ever inserts or updates — it never deletes. So rows from
 * earlier imports (the previous 7-category / 37-tour set, the extra East
 * African parks, demo seed data) stay in the database alongside the current
 * set, and keep showing up in the mega-menu and on listing pages.
 *
 * This soft-deletes any destination, category or tour whose slug is not in the
 * current goldfinch-import-ready CSVs. Soft delete = sets deleted_at, exactly
 * what the admin Delete button does, so it is reversible. Every foreign key
 * into these tables is ON DELETE SET NULL and a soft delete does not even
 * trigger that, so no child row is touched.
 *
 * Dry run by default — prints what it would remove and changes nothing:
 *   npm run content:prune                 (dev / tsx)
 *   npm run content:prune:prod            (built / node dist)
 *
 * Add --apply to actually remove them:
 *   npm run content:prune -- --apply
 */
import { supabase } from '../config/supabase';

// The select list is built from cfg.nameColumn, which supabase-js cannot type
// statically, so the response is narrowed by hand.
type ContentRow = { id: string; slug: string } & Record<string, unknown>;
type ContentResponse = { data: ContentRow[] | null; error: { message: string } | null };

const KEEP: Record<string, { label: string; nameColumn: string; slugs: string[] }> = {
  destinations: {
    label: 'Destinations',
    nameColumn: 'name',
    slugs: [
      'arusha-city', 'arusha-national-park', 'central-serengeti', 'lake-manyara-national-park',
      'mafia-island', 'mikumi-national-park', 'mount-kilimanjaro', 'ndutu-southern-serengeti',
      'ngorongoro-crater', 'northern-serengeti', 'nungwi-kendwa', 'nyerere-national-park',
      'paje-jambiani', 'ruaha-national-park', 'serengeti-national-park', 'stone-town',
      'tarangire-national-park', 'western-serengeti', 'zanzibar'
    ]
  },
  tour_categories: {
    label: 'Safari types / categories',
    nameColumn: 'name',
    slugs: [
      'chimp-trekking-tours', 'classic-tanzania-safaris', 'family-safari-tanzania',
      'gorilla-trekking-tours', 'great-migration-safari-tanzania', 'kenya-and-tanzania-tours',
      'luxury-tanzania-safaris', 'safari-from-nairobi', 'safari-from-zanzibar',
      'tanzania-and-zanzibar-holidays', 'tanzania-cultural-experiences',
      'tanzania-honeymoon-safari', 'zanzibar-beach-holidays'
    ]
  },
  tours: {
    label: 'Tours',
    nameColumn: 'title',
    slugs: [
      '4-day-gombe-chimpanzee-trek', 'custom-chimp-trekking-tour',
      '5-day-mahale-mountains-chimpanzee-safari', '6-day-kibale-chimps-queen-elizabeth-safari',
      '7-day-mahale-chimpanzee-serengeti-safari', '9-day-chimps-gorillas-primate-journey',
      '3-day-tarangire-ngorongoro-safari', 'custom-classic-tanzania-safari',
      '4-day-northern-circuit-safari', '5-day-classic-tanzania-safari',
      '6-day-serengeti-ngorongoro-safari', '7-day-classic-tanzania-safari',
      '7-day-northern-tanzania-safari', '3-day-family-safari-in-tanzania',
      'custom-tanzania-family-safari', '5-day-tanzania-family-safari',
      '6-day-serengeti-family-safari', '8-day-family-safari-zanzibar',
      '10-day-tanzania-family-holiday', '3-day-rwanda-gorilla-trek-from-kigali',
      'custom-gorilla-trekking-tour', '4-day-bwindi-gorilla-fly-in-safari',
      '5-day-bwindi-gorilla-trekking-safari', '6-day-double-gorilla-trek-habituation',
      '9-day-gorillas-chimps-savannah-safari', '5-day-ndutu-calving-season-safari',
      'custom-great-migration-safari', '6-day-serengeti-migration-safari',
      '7-day-northern-serengeti-migration-safari', '8-day-mara-river-crossing-safari',
      '10-day-serengeti-migration-ngorongoro-safari', '7-day-masai-mara-serengeti-safari',
      'custom-kenya-tanzania-tour', '9-day-kenya-tanzania-classic-circuit',
      '10-day-kenya-tanzania-highlights-safari', '12-day-great-migration-crossing-safari',
      '14-day-kenya-tanzania-zanzibar-journey', '5-day-luxury-tanzania-safari',
      'custom-luxury-tanzania-safari', '7-day-luxury-serengeti-ngorongoro-safari',
      '8-day-fly-in-luxury-tanzania-safari', '10-day-luxury-safari-zanzibar-honeymoon',
      '12-day-luxury-tanzania-zanzibar-holiday', 'amboseli-day-trip-from-nairobi',
      'custom-safari-from-nairobi', 'nairobi-national-park-morning-safari',
      '3-day-masai-mara-fly-in-safari', '4-day-mara-lake-nakuru-safari',
      '6-day-kenya-classic-from-nairobi', 'custom-safari-from-zanzibar',
      '1-day-mikumi-safari-from-zanzibar', '2-day-tarangire-ngorongoro-safari',
      '3-day-safari-from-zanzibar', '4-day-serengeti-safari-from-zanzibar',
      '5-day-serengeti-ngorongoro-safari', '7-day-tanzania-safari-zanzibar',
      'custom-tanzania-zanzibar-holiday', '9-day-serengeti-zanzibar-holiday',
      '10-day-safari-zanzibar-escape', '12-day-honeymoon-safari-zanzibar',
      '14-day-tanzania-safari-beach-holiday', 'hadzabe-datoga-cultural-day',
      'maasai-visit-during-safari', 'materuni-coffee-waterfalls',
      'mto-wa-mbu-village-experience', 'stone-town-cultural-stay',
      '7-day-safari-with-cultural-add-on', '5-day-honeymoon-safari-adventure',
      'custom-tanzania-honeymoon-safari', '7-day-romantic-tanzania-safari',
      '8-day-serengeti-honeymoon-safari', '10-day-safari-zanzibar-honeymoon',
      '12-day-tanzania-honeymoon-zanzibar', 'safari-from-zanzibar-beach-stay',
      'custom-zanzibar-beach-holiday', 'mafia-island-beach-escape',
      'family-safari-zanzibar-beach', 'tanzania-honeymoon-safari-beach',
      'tanzania-safari-zanzibar-holiday'
    ]
  }
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  let total = 0;

  for (const [table, cfg] of Object.entries(KEEP)) {
    const { data, error } = (await supabase
      .from(table)
      .select(`id, slug, ${cfg.nameColumn}`)
      .is('deleted_at', null)) as unknown as ContentResponse;
    if (error) throw new Error(`${table}: ${error.message}`);

    const keep = new Set(cfg.slugs);
    const strays = (data ?? []).filter((row) => !keep.has(row.slug));

    console.log(`\n${cfg.label} — keeping ${cfg.slugs.length}, found ${data?.length ?? 0} live, ${strays.length} not in the import set:`);
    for (const row of strays) console.log(`   - ${String(row[cfg.nameColumn])}  (${row.slug})`);
    if (!strays.length) console.log('   (nothing to remove)');
    total += strays.length;

    if (apply && strays.length) {
      const { error: delError } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .in('id', strays.map((row) => row.id));
      if (delError) throw new Error(`${table}: ${delError.message}`);
      console.log(`   → removed ${strays.length}`);
    }
  }

  // Soft delete leaves foreign keys intact (ON DELETE SET NULL only fires on a
  // real delete), so rows can still point at something that is no longer
  // visible. Re-importing does not clear these either: a blank CSV cell now
  // means "leave this column alone". So they are cleared here.
  const dangling: { table: string; column: string; parent: string }[] = [
    { table: 'tours', column: 'destination_id', parent: 'destinations' },
    { table: 'tours', column: 'category_id', parent: 'tour_categories' },
    { table: 'faqs', column: 'destination_id', parent: 'destinations' },
    { table: 'lodges', column: 'destination_id', parent: 'destinations' }
  ];

  let danglingTotal = 0;
  for (const ref of dangling) {
    const { data: removed } = (await supabase
      .from(ref.parent)
      .select('id')
      .not('deleted_at', 'is', null)) as unknown as { data: { id: string }[] | null };
    const removedIds = (removed ?? []).map((row) => row.id);
    if (!removedIds.length) continue;

    const { data: broken, error } = (await supabase
      .from(ref.table)
      .select('id')
      .in(ref.column, removedIds)) as unknown as ContentResponse;
    if (error) {
      console.warn(`\n${ref.table}.${ref.column}: skipped (${error.message})`);
      continue;
    }
    if (!broken?.length) continue;

    danglingTotal += broken.length;
    console.log(`\n${ref.table}.${ref.column} — ${broken.length} row(s) point at a removed ${ref.parent} record.`);
    if (apply) {
      const { error: clearError } = await supabase
        .from(ref.table)
        .update({ [ref.column]: null })
        .in('id', broken.map((row) => row.id));
      if (clearError) throw new Error(`${ref.table}.${ref.column}: ${clearError.message}`);
      console.log(`   → cleared ${broken.length}`);
    }
  }

  console.log(
    apply
      ? `\nDone. Removed ${total} row(s) and cleared ${danglingTotal} dangling reference(s).` +
        '\nRe-import 01, 02 then 03 to rebuild the links, then allow 5 minutes for the public cache.'
      : `\nDry run — nothing changed. ${total} row(s) would be removed and ` +
        `${danglingTotal} dangling reference(s) cleared. Re-run with --apply to do it.`
  );
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
