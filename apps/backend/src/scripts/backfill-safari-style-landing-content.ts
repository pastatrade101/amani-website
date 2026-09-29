/**
 * Makes every stored safari-style planning guide publish-ready for the shared
 * landing-page UI. Existing editorial prose is preserved; old instructional
 * placeholders are replaced with CMS-derived copy, and each guide block gets
 * at least one internal link.
 *
 * Safe to rerun: it targets non-deleted categories and writes the same
 * canonical structure each time.
 */
import { supabase } from '../config/supabase';

type LandingLink = { label: string; href: string };
type LandingBlock = { title: string; body: string; links: LandingLink[] };
type LandingContent = {
  planningGuide?: { blocks?: LandingBlock[] };
  [key: string]: unknown;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const isInternalLink = (link: unknown): link is LandingLink => {
  if (!link || typeof link !== 'object') return false;
  const value = link as Partial<LandingLink>;
  return Boolean(
    value.label?.trim()
      && value.href?.trim()
      && (/^#/.test(value.href) || (/^\//.test(value.href) && !/^\/\//.test(value.href)))
  );
};

const run = async () => {
  const [categoryResult, tourResult, joinResult, destinationResult] = await Promise.all([
    supabase
      .from('tour_categories')
      .select('id,name,slug,best_months,landing_page_content')
      .is('deleted_at', null),
    supabase
      .from('tours')
      .select('id,category_id,destination_id')
      .eq('status', 'published')
      .is('deleted_at', null),
    supabase
      .from('tour_destinations')
      .select('tour_id,destination_id,sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('destinations')
      .select('id,name,slug')
      .eq('status', 'published')
      .is('deleted_at', null)
  ]);

  for (const result of [categoryResult, tourResult, joinResult, destinationResult]) {
    if (result.error) throw result.error;
  }

  const categories = categoryResult.data ?? [];
  const tours = tourResult.data ?? [];
  const joins = joinResult.data ?? [];
  const destinations = destinationResult.data ?? [];
  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
  const joinsByTour = new Map<string, typeof joins>();

  for (const join of joins) {
    const rows = joinsByTour.get(join.tour_id) ?? [];
    rows.push(join);
    joinsByTour.set(join.tour_id, rows);
  }

  let updated = 0;
  let skipped = 0;

  for (const category of categories) {
    const content = category.landing_page_content as LandingContent | null;
    const existingBlocks = content?.planningGuide?.blocks;
    if (!content || !Array.isArray(existingBlocks) || existingBlocks.length !== 4) {
      skipped += 1;
      console.warn(`Skipped ${category.slug}: no complete four-block landing document.`);
      continue;
    }

    const categoryTours = tours.filter((tour) => tour.category_id === category.id);
    const destinationIds: string[] = [];
    for (const tour of categoryTours) {
      if (tour.destination_id) destinationIds.push(tour.destination_id);
      for (const join of joinsByTour.get(tour.id) ?? []) destinationIds.push(join.destination_id);
    }

    let categoryDestinations = [...new Set(destinationIds)]
      .map((id) => destinationById.get(id))
      .filter((destination): destination is NonNullable<typeof destination> => Boolean(destination));

    if (category.slug === 'safari-from-zanzibar') {
      const preferredOrder = [
        'Nyerere National Park',
        'Mikumi National Park',
        'Tarangire National Park',
        'Lake Manyara National Park',
        'Serengeti National Park',
        'Zanzibar'
      ];
      categoryDestinations = categoryDestinations.sort((a, b) => {
        const aIndex = preferredOrder.indexOf(a.name);
        const bIndex = preferredOrder.indexOf(b.name);
        return (aIndex < 0 ? preferredOrder.length : aIndex) - (bIndex < 0 ? preferredOrder.length : bIndex);
      });
    }

    const monthNames = (Array.isArray(category.best_months) ? category.best_months : [])
      .map(Number)
      .filter((month) => month >= 1 && month <= 12)
      .map((month) => MONTHS[month - 1]);

    const defaults: LandingLink[][] = [
      [{ label: 'Read our Tanzania travel advice', href: '/expert-advice' }],
      categoryDestinations.length
        ? categoryDestinations.slice(0, 6).map((destination) => ({
            label: destination.name,
            href: `/destinations/${destination.slug}`
          }))
        : [{ label: 'Explore safari destinations', href: '/destinations' }],
      [{ label: 'Read our safari planning advice', href: '/expert-advice' }],
      [{ label: `Request a ${String(category.name).toLowerCase()} plan`, href: '#lead-form' }]
    ];

    const blocks = existingBlocks.map((block, index) => ({
      ...block,
      links: (Array.isArray(block.links) ? block.links.filter(isInternalLink) : []).length
        ? block.links.filter(isInternalLink)
        : defaults[index]
    }));

    const firstBody = String(blocks[0].body ?? '').trim();
    if (/^Explain the best seasons/i.test(firstBody)) {
      blocks[0].body = monthNames.length
        ? `${monthNames.join(', ')} are highlighted in the CMS for this safari style. We refine the timing around wildlife, weather and availability.`
        : `The best season for ${String(category.name).toLowerCase()} depends on wildlife, weather and availability. We match your dates to the strongest route for that time of year.`;
    }

    const secondBody = String(blocks[1].body ?? '').trim();
    if (/^Explain the strongest parks/i.test(secondBody)) {
      blocks[1].body = categoryDestinations.length
        ? `${categoryDestinations.slice(0, 6).map((destination) => destination.name).join(', ')}${categoryDestinations.length > 6 ? ' and more' : ''} appear across the published trips for this safari style.`
        : `We select the parks that best support ${String(category.name).toLowerCase()}, then balance wildlife time with realistic transfers and well-located stays.`;
    }

    if (/^Explain the typical price range/i.test(String(blocks[2].body ?? '').trim())) {
      blocks[2].body = 'The final price depends on your dates, group size, route, flights and preferred lodge standard.';
    }

    if (/^Explain the recommended route order/i.test(String(blocks[3].body ?? '').trim())) {
      blocks[3].body = 'We order the route around travel time, flight connections and enough nights in each key area.';
    }

    const nextContent: LandingContent = {
      ...content,
      planningGuide: { ...content.planningGuide, blocks }
    };
    const update = await supabase
      .from('tour_categories')
      .update({ landing_page_content: nextContent })
      .eq('id', category.id);
    if (update.error) throw update.error;
    updated += 1;
    console.log(`Updated ${category.slug}.`);
  }

  console.log(`Done. ${updated} updated, ${skipped} skipped.`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
