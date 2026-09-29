export type StyleLandingLink = { label: string; href: string };

export type StyleLandingContent = {
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    primaryCtaLabel: string;
    secondaryCtaLabel: string;
    trustLine: string;
  };
  trustChips: string[];
  overview: {
    label: string;
    headline: string;
    paragraphs: string[];
    imageUrl: string;
  };
  planner: { label: string; headline: string; intro: string };
  tourCollection: {
    label: string;
    headline: string;
    subheadline: string;
    resultsNoun: string;
    loadMoreLabel: string;
  };
  planningGuide: {
    label: string;
    title: string;
    intro: string;
    blocks: Array<{ title: string; body: string; links: StyleLandingLink[] }>;
  };
  advisor: { headline: string; intro: string; big: string[]; quiet: string[] };
  howItsPlanned: {
    label: string;
    title: string;
    intro: string;
    steps: Array<{ title: string; text: string }>;
  };
  reviews: { label: string; title: string; intro: string };
  faq: { title: string; answeredBy: string };
  finalCta: {
    label: string;
    headline: string;
    subheadline: string;
    proofs: string[];
    buttonLabel: string;
    whatsappLabel: string;
  };
};

type CategorySeed = {
  name?: string | null;
  short_description?: string | null;
  description?: string | null;
  highlights?: string[] | null;
  image_url?: string | null;
  best_months?: number[] | null;
  planning_notes?: { costs?: string | null; route?: string | null } | null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const plain = (value: unknown) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const four = (items: string[], fallbacks: string[]) =>
  [...items.map(plain).filter(Boolean), ...fallbacks].slice(0, 4);

/**
 * Complete copy-pasteable CMS document for one safari-style landing page.
 * It is intentionally the same shape the public template consumes.
 */
export const defaultStyleLandingContent = (category: CategorySeed = {}): StyleLandingContent => {
  const name = plain(category.name) || 'Tanzania Safari';
  const lower = name.toLowerCase();
  const intro = plain(category.short_description) || plain(category.description) || `Explore ${lower} with local planning support.`;
  const chips = four(category.highlights ?? [], [
    'Private safari routes',
    'Local Tanzania guides',
    'Tailor-made planning',
    'Clear local support'
  ]);
  const bestMonths = (category.best_months ?? [])
    .map(Number)
    .filter((month) => month >= 1 && month <= 12)
    .map((month) => MONTHS[month - 1]);

  return {
    hero: {
      eyebrow: name,
      headline: `${name} Planned With Local Expertise`,
      subheadline: intro,
      primaryCtaLabel: 'Request a Safari Plan',
      secondaryCtaLabel: 'View Safari Ideas',
      trustLine: chips.join(' · ')
    },
    trustChips: chips,
    overview: {
      label: name,
      headline: `${name}, Done Properly`,
      paragraphs: [intro, `The right ${lower} depends on your dates, available time, comfort level and preferred pace.`],
      imageUrl: category.image_url || ''
    },
    planner: {
      label: 'Plan This Experience',
      headline: 'Want This Style of Tanzania Trip?',
      intro: "Share a few details and we'll help shape the route, timing and comfort level around your dates."
    },
    tourCollection: {
      label: 'Safari Ideas',
      headline: `${name} Safari Ideas`,
      subheadline: 'Explore published routes for this safari style. Use the filters to compare by duration, comfort level and starting price.',
      resultsNoun: `${lower} safari ideas`,
      loadMoreLabel: 'Load More Safaris'
    },
    planningGuide: {
      label: 'Planning Guide',
      title: `How to Plan ${name}`,
      intro: 'Start with your available time, dates and priorities. The strongest trip balances the places you want to see with realistic travel time, well-located stays and the right comfort level.',
      blocks: [
        {
          title: 'Best time to go',
          body: bestMonths.length
            // Written for the traveller reading it, not the person filling it
            // in. The old wording told visitors what was "highlighted in the
            // CMS", which names our admin tool on a public sales page.
            ? `${bestMonths.join(', ')} are the strongest months for this kind of trip. We refine the timing around wildlife, weather and availability.`
            : `The best season for ${lower} depends on wildlife, weather and availability. We match your dates to the strongest route for that time of year.`,
          links: [{ label: 'Read our Tanzania travel advice', href: '/expert-advice' }]
        },
        {
          title: 'Best safari parks',
          body: `We select the parks that best support ${lower}, then balance wildlife time with realistic transfers and well-located stays.`,
          links: [{ label: 'Explore safari destinations', href: '/destinations' }]
        },
        {
          title: 'Travel costs',
          body: plain(category.planning_notes?.costs) || 'The final price depends on your dates, group size, route, flights and preferred lodge standard.',
          links: [{ label: 'Read our safari planning advice', href: '/expert-advice' }]
        },
        {
          title: 'Route planning',
          body: plain(category.planning_notes?.route) || 'We order the route around travel time, flight connections and enough nights in each key area.',
          links: [{ label: `Request a ${lower} plan`, href: '#lead-form' }]
        }
      ]
    },
    advisor: {
      headline: 'What We Help You Get Right',
      intro: `${name} can look simple on paper, but the quality of the trip depends on route order, timing, stay choice and daily pacing.`,
      big: [
        `How many days to give ${lower}.`,
        'Which parks and places to include and which to skip.',
        'Whether to drive, fly or combine both.',
        'How to balance wildlife, travel time and comfort.'
      ],
      quiet: [
        'Lodge location inside or outside key areas.',
        'Avoiding rushed one-night stops.',
        'Matching the guide and activity style to your interests.',
        'Planning around season, road time and transfer logistics.'
      ]
    },
    howItsPlanned: {
      label: 'How Your Trip Is Planned',
      title: 'From First Note to Final Sundowner',
      intro: 'Simple planning, clear proposals and no pressure.',
      steps: [
        { title: 'Tell Us Your Travel Style', text: "A short conversation about who's travelling, your dates and the pace you enjoy." },
        { title: 'We Shape the Right Route', text: 'We suggest which parks, coast, number of nights and route make sense.' },
        { title: 'We Refine Lodges, Flights & Pacing', text: 'Camps and transfers are matched to season, budget and travel style.' },
        { title: 'You Travel With Support on the Ground', text: 'Local guides and someone reachable from arrival to departure.' }
      ]
    },
    reviews: {
      label: 'Traveller Stories',
      title: 'Travellers Who Planned Tanzania With Us',
      intro: 'Real guests, real routes and the planning details that made their trips work.'
    },
    faq: { title: `Questions About ${name}`, answeredBy: 'Key2africa Safaris' },
    finalCta: {
      label: 'Start Planning',
      headline: `Request Your ${name} Plan`,
      subheadline: "Tell us your travel dates, group size and preferred safari style. We'll recommend a route that fits your time, budget and pace.",
      proofs: [
        'Tailored to your dates and budget',
        'Local Tanzania safari experts',
        'Clear proposal with no obligation',
        'Response within 24 hours'
      ],
      buttonLabel: 'Request Your Safari Plan',
      whatsappLabel: 'Prefer WhatsApp? Message us here →'
    }
  };
};

const isText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const isTextArray = (value: unknown, exact: number) =>
  Array.isArray(value) && value.length === exact && value.every(isText);

export const styleLandingContentErrors = (value: unknown): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Landing-page content must be a JSON object.'];
  const data = value as Partial<StyleLandingContent>;
  const errors: string[] = [];
  const requiredText = (path: string, field: unknown) => { if (!isText(field)) errors.push(`${path} is required.`); };

  requiredText('hero.eyebrow', data.hero?.eyebrow);
  requiredText('hero.headline', data.hero?.headline);
  requiredText('hero.subheadline', data.hero?.subheadline);
  requiredText('hero.primaryCtaLabel', data.hero?.primaryCtaLabel);
  requiredText('hero.secondaryCtaLabel', data.hero?.secondaryCtaLabel);
  requiredText('hero.trustLine', data.hero?.trustLine);
  if (!isTextArray(data.trustChips, 4)) errors.push('trustChips must contain exactly 4 non-empty items.');
  requiredText('overview.label', data.overview?.label);
  requiredText('overview.headline', data.overview?.headline);
  // Both ends, because the server enforces both. Checking only the lower bound
  // let the editor call a section complete while the save was refused for
  // having too many — the one disagreement this validator exists to prevent.
  if (!Array.isArray(data.overview?.paragraphs) || data.overview!.paragraphs.length < 1 || !data.overview!.paragraphs.every(isText)) errors.push('overview.paragraphs must contain at least 1 non-empty paragraph.');
  else if (data.overview!.paragraphs.length > 4) errors.push('overview.paragraphs must contain at most 4 paragraphs.');
  // The overview band is a photo beside the paragraphs, so it is required
  // rather than optional — without one the section publishes half empty.
  requiredText('overview.imageUrl', data.overview?.imageUrl);
  for (const key of ['label', 'headline', 'intro'] as const) requiredText(`planner.${key}`, data.planner?.[key]);
  for (const key of ['label', 'headline', 'subheadline', 'resultsNoun', 'loadMoreLabel'] as const) requiredText(`tourCollection.${key}`, data.tourCollection?.[key]);
  for (const key of ['label', 'title', 'intro'] as const) requiredText(`planningGuide.${key}`, data.planningGuide?.[key]);
  if (!Array.isArray(data.planningGuide?.blocks) || data.planningGuide!.blocks.length !== 4) errors.push('planningGuide.blocks must contain exactly 4 blocks.');
  else data.planningGuide.blocks.forEach((block, index) => {
    requiredText(`planningGuide.blocks[${index}].title`, block?.title);
    requiredText(`planningGuide.blocks[${index}].body`, block?.body);
    if (!Array.isArray(block?.links) || block.links.length < 1) {
      errors.push(`planningGuide.blocks[${index}].links must contain at least 1 internal link.`);
    } else if (block.links.length > 8) {
      errors.push(`planningGuide.blocks[${index}].links must contain at most 8 links.`);
    } else {
      block.links.forEach((link, linkIndex) => {
        requiredText(`planningGuide.blocks[${index}].links[${linkIndex}].label`, link?.label);
        requiredText(`planningGuide.blocks[${index}].links[${linkIndex}].href`, link?.href);
        if (isText(link?.href) && !/^(?:\/(?!\/)|#)/.test(link.href)) {
          errors.push(`planningGuide.blocks[${index}].links[${linkIndex}].href must be an internal path or page anchor.`);
        }
      });
    }
  });
  requiredText('advisor.headline', data.advisor?.headline);
  requiredText('advisor.intro', data.advisor?.intro);
  if (!isTextArray(data.advisor?.big, 4)) errors.push('advisor.big must contain exactly 4 non-empty items.');
  if (!isTextArray(data.advisor?.quiet, 4)) errors.push('advisor.quiet must contain exactly 4 non-empty items.');
  for (const key of ['label', 'title', 'intro'] as const) requiredText(`howItsPlanned.${key}`, data.howItsPlanned?.[key]);
  if (!Array.isArray(data.howItsPlanned?.steps) || data.howItsPlanned!.steps.length !== 4) errors.push('howItsPlanned.steps must contain exactly 4 steps.');
  else data.howItsPlanned.steps.forEach((step, index) => {
    requiredText(`howItsPlanned.steps[${index}].title`, step?.title);
    requiredText(`howItsPlanned.steps[${index}].text`, step?.text);
  });
  for (const key of ['label', 'title', 'intro'] as const) requiredText(`reviews.${key}`, data.reviews?.[key]);
  requiredText('faq.title', data.faq?.title);
  requiredText('faq.answeredBy', data.faq?.answeredBy);
  for (const key of ['label', 'headline', 'subheadline', 'buttonLabel', 'whatsappLabel'] as const) requiredText(`finalCta.${key}`, data.finalCta?.[key]);
  if (!isTextArray(data.finalCta?.proofs, 4)) errors.push('finalCta.proofs must contain exactly 4 non-empty items.');
  return errors;
};

export const parseStyleLandingJson = (json: string): { data: StyleLandingContent | null; errors: string[] } => {
  if (!json.trim()) return { data: null, errors: ['Landing-page content is required before publishing.'] };
  try {
    const value = JSON.parse(json);
    const errors = styleLandingContentErrors(value);
    return { data: errors.length ? null : value as StyleLandingContent, errors };
  } catch (error) {
    return { data: null, errors: [error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.'] };
  }
};
