import { blockSpec, emptyBlock, lines, str, type Block } from './safariPackageBlocks';

/** Layout belongs to the template. Stable sorting preserves every saved section. */
export const SECTION_ORDER = ['facts', 'prose', 'highlights', 'routes', 'itinerary', 'tiers', 'priceguide', 'compare', 'inclusions', 'expectations', 'gallery', 'tours', 'advisor', 'faq', 'enquiry'];

export const orderedPackageBlocks = (blocks: Block[]): Block[] =>
  [...blocks].sort((a, b) => {
    const rank = (type: string) => SECTION_ORDER.includes(type) ? SECTION_ORDER.indexOf(type) : SECTION_ORDER.length;
    return rank(a.type) - rank(b.type);
  });

export const starterPackageBlocks = (): Block[] =>
  ['facts', 'prose', 'routes', 'faq', 'enquiry'].map(emptyBlock);

export const sectionSummary = (block: Block): string => {
  const title = str(block.title).trim();
  if (title) return title;
  const collection = ['items', 'routes', 'tiers', 'images', 'rows'].find((key) => Array.isArray(block[key]));
  if (collection && (block[collection] as unknown[]).length) return `${(block[collection] as unknown[]).length} ${collection === 'items' ? 'items' : collection}`;
  return blockSpec(block.type)?.blurb ?? 'Saved content is preserved.';
};

/** Advice, never character limits or automatic deletion of existing copy. */
export const sectionGuidance = (block: Block): string[] => {
  const notes: string[] = [];
  if (str(block.title).length > 110) notes.push('A shorter heading is easier to scan. The page will wrap this heading safely.');
  if (str(block.intro).length > 450) notes.push('Keep the introduction brief; use an overview section for the full story.');
  if (block.type === 'prose' && !str(block.body).trim()) notes.push('Add your overview to show this section on the page.');
  if (block.type === 'prose' && Boolean(str(block.aside_title).trim()) !== Boolean(str(block.aside_body).trim())) notes.push('Add both the note heading and text to show the companion card.');
  if (block.type === 'facts' && Array.isArray(block.items)) {
    if (block.items.length > 5) notes.push('Three to five facts are easiest to compare. Extra facts wrap into another row.');
    if (!block.items.length || block.items.some((item) => !str(item?.value).trim())) notes.push('Give each fact a value. Empty facts stay off the page.');
  }
  if (block.type === 'routes') {
    const routes = Array.isArray(block.routes) ? block.routes : [];
    if (!routes.length) notes.push('Add a route and select its published tour to show route options.');
    for (const [index, route] of routes.entries()) {
      const comforts = Array.isArray(route.comforts) ? route.comforts : [];
      if (!comforts.some((item: Record<string, unknown>) => str(item.tour_slug).trim()) && !lines(route.tours).length)
        notes.push(`Route ${index + 1}: select a tour. Its photographs, prices and itinerary fill in automatically.`);
      if (comforts.some((item: Record<string, unknown>) => !str(item.accommodation_level).trim()))
        notes.push(`Route ${index + 1}: choose an accommodation category so travellers can compare it clearly.`);
    }
  }
  if (block.type === 'faq') notes.push('If no questions are entered here, the page uses FAQs attached to this package.');
  if (block.type === 'itinerary') notes.push('The itinerary comes from the tour selected in Page details.');
  if (!blockSpec(block.type)) notes.push('This section was saved by another editor. Its content is kept when you save.');
  return notes;
};
