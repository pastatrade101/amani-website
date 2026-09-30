<script lang="ts">
  import EditorNavigation from './EditorNavigation.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import * as CmsDialog from '$lib/components/ui/dialog';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { createEventDispatcher, tick } from 'svelte';
  import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Check,
    CircleDollarSign,
    ExternalLink,
    FileText,
    Hotel,
    Images,
    Languages,
    MapPin,
    Plus,
    Save,
    ScrollText,
    Search,
    Trash2,
    X
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminFormInput from './AdminFormInput.svelte';
  import AdminLodgeMedia from './AdminLodgeMedia.svelte';
  import AdminRichText from './AdminRichText.svelte';
  import AdminSelect from './AdminSelect.svelte';
  import AdminTextArea from './AdminTextArea.svelte';
  import AdminTranslationTabs from './AdminTranslationTabs.svelte';
  import MediaPicker from './MediaPicker.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import StyleBadge from './accommodation/StyleBadge.svelte';
  import {
    BEST_FOR_LABELS,
    LODGE_STATUSES,
    PROPERTY_TYPES,
    STYLE_ICONS,
    STYLE_NAMES,
    propertyTypeOf,
    type LodgeStatus,
    type LodgeType
  } from './accommodation/property';
  import { hasRichContent } from '$lib/admin/richText';
  import { BEST_FOR, normalizeBestFor } from '$lib/admin/accommodationEnums';
  import type { Lodge } from '$lib/admin/types';
  import { LODGE_LEVELS, styleForLodgeLevel, type LodgeLevel } from '$lib/lodge-levels';
  import { SAFARI_STYLE_THEME, type SafariStyle } from '$lib/safari-pricing';
  import { DEFAULT_COUNTRY, EAST_AFRICA_COUNTRIES, toEastAfricaCountry } from '$lib/countries';

  type TabKey = 'basics' | 'about' | 'location' | 'media' | 'rates' | 'seo' | 'translations';
  type Row = Record<string, unknown>;
  type DestinationOption = { id: string; name: string; status?: string | null };
  type TourUse = { id: string; title: string; status: string; styles: SafariStyle[]; days: number[] };
  /** Detail tables this editor does not show, sent back as loaded (see saveHighlights). */
  type Preserved = {
    rooms: Row[];
    rates: Row[];
    inclusions: Row[];
    supplier: Row | null;
    destination_ids: string[];
    tour_ids: string[];
    alternative_ids: string[];
    experience_ids: string[];
  };

  /** The full lodge record (never a lean list row), or null for a new property. */
  export let editing: Lodge | null = null;
  export let destinations: DestinationOption[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    saved: { close: boolean; message: string };
    toast: { message: string; type: 'error' | 'success' };
  }>();

  /** Same stepped editor as Categories and Activities: one concern per step, Save always in reach. */
  const TABS = [
    ['basics', FileText, 'Essentials'],
    ['about', ScrollText, 'About the stay'],
    ['location', MapPin, 'Location & practical'],
    ['media', Images, 'Photos'],
    ['rates', CircleDollarSign, 'Rates & tours'],
    ['seo', Search, 'Search & sharing'],
    ['translations', Languages, 'Translations']
  ] as const;

  const STEP_HINTS: Record<TabKey, string> = {
    basics: 'Name the property, say what kind of stay it is, and match it to a safari style.',
    about: 'What travellers read about the stay, and who it suits best.',
    location: 'The practical facts a planner needs when building an itinerary.',
    media: 'The hero and card photos, then the gallery and amenities.',
    rates: 'An indicative nightly rate, and the tours that stay here.',
    seo: 'How the property appears in search results and when shared.',
    translations: 'The property in every language the site offers.'
  };

  const CHILDREN_OPTIONS = [
    { label: 'Not stated', value: '' },
    { label: 'Yes, children welcome', value: 'yes' },
    { label: 'No, adults only', value: 'no' }
  ];

  const MAX_HIGHLIGHTS = 30;
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  type LodgeForm = {
    name: string;
    slug: string;
    lodge_type: LodgeType;
    accommodation_level: LodgeLevel;
    destination_id: string;
    status: LodgeStatus;
    is_featured: boolean;
    show_property_publicly: boolean;
    short_description: string;
    description: string;
    why_we_recommend: string;
    highlights: string[];
    best_for: string[];
    country: string;
    park_area: string;
    region: string;
    latitude: string;
    longitude: string;
    nearest_airport: string;
    transfer_time: string;
    recommended_nights: string;
    children: '' | 'yes' | 'no';
    minimum_child_age: string;
    hero_image_url: string;
    image_url: string;
    price_per_night_from: string;
    currency: string;
    show_rates_publicly: boolean;
    seo_title: string;
    meta_description: string;
    social_image_url: string;
    indexable: boolean;
  };

  const text = (value: unknown) => (value == null ? '' : String(value));
  const levelOf = (value: unknown): LodgeLevel =>
    LODGE_LEVELS.find((level) => level.value === String(value ?? '').toUpperCase())?.value ?? 'MID_RANGE';
  const statusOf = (value: unknown): LodgeStatus =>
    LODGE_STATUSES.find((status) => status.value === value)?.value ?? 'draft';

  const initialForm = (lodge: Lodge | null): LodgeForm => {
    const children = lodge?.children_allowed;
    const childAge = lodge?.minimum_child_age;
    return {
      name: text(lodge?.name),
      slug: text(lodge?.slug),
      lodge_type: propertyTypeOf(lodge?.lodge_type) ?? 'SAFARI_LODGE',
      accommodation_level: levelOf(lodge?.accommodation_level),
      destination_id: text(lodge?.destination_id),
      status: statusOf(lodge?.status),
      is_featured: Boolean(lodge?.is_featured),
      show_property_publicly: lodge?.show_property_publicly !== false,
      short_description: text(lodge?.short_description),
      description: text(lodge?.description),
      why_we_recommend: text(lodge?.why_we_recommend),
      highlights: [''],
      best_for: normalizeBestFor(lodge?.best_for),
      country: toEastAfricaCountry(lodge?.country) ?? (lodge?.country ? '' : DEFAULT_COUNTRY),
      park_area: text(lodge?.park_area),
      region: text(lodge?.region),
      latitude: text(lodge?.latitude),
      longitude: text(lodge?.longitude),
      nearest_airport: text(lodge?.nearest_airport),
      transfer_time: text(lodge?.transfer_time),
      recommended_nights: text(lodge?.recommended_nights),
      // A stored minimum age with no yes/no still means children are welcome.
      children: children === true || (children == null && childAge != null) ? 'yes' : children === false ? 'no' : '',
      minimum_child_age: text(childAge),
      hero_image_url: text(lodge?.hero_image_url),
      image_url: text(lodge?.image_url),
      price_per_night_from: text(lodge?.price_per_night_from),
      currency: text(lodge?.currency) || 'USD',
      show_rates_publicly: Boolean(lodge?.show_rates_publicly),
      seo_title: text(lodge?.seo_title || lodge?.meta_title),
      meta_description: text(lodge?.meta_description),
      social_image_url: text(lodge?.social_image_url),
      indexable: lodge?.indexable !== false
    };
  };

  let form = initialForm(editing);
  /** Set once the lodge row exists, so a retry after a partial save updates instead of creating twice. */
  let savedId = editing?.id ?? '';
  let activeTab: TabKey = 'basics';
  let bodyEl: HTMLDivElement;
  let saving = false;
  let attemptedSave = false;
  let slugManuallyEdited = Boolean(editing);

  const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  $: if (!slugManuallyEdited) form.slug = slugify(form.name);

  $: visibleTabs = TABS.filter(([key]) => key !== 'translations' || savedId);
  $: stepIndex = visibleTabs.findIndex(([key]) => key === activeTab);
  $: lodgeStyle = styleForLodgeLevel(form.accommodation_level);
  $: destinationOptions = [
    { label: 'No destination yet', value: '' },
    ...destinations.map((d) => ({ label: d.status && d.status !== 'published' ? `${d.name} (${d.status})` : d.name, value: d.id })),
    // Keep a destination that is no longer in the list selectable rather than showing it blank.
    ...(form.destination_id && !destinations.some((d) => d.id === form.destination_id)
      ? [{ label: 'Current destination', value: form.destination_id }]
      : [])
  ];

  // ── Details: highlights (edited here) and tours_using (read only) ────────
  // PUT /lodges/:id/details replaces every detail table at once, so the tables
  // this editor does not show are loaded and sent back untouched.
  let detailsState: 'ready' | 'loading' | 'failed' = editing ? 'loading' : 'ready';
  let preserved: Preserved = { rooms: [], rates: [], inclusions: [], supplier: null, destination_ids: [], tour_ids: [], alternative_ids: [], experience_ids: [] };
  let highlightBaseline = '[]';
  let toursUsing: TourUse[] = [];

  const list = (value: unknown): Row[] =>
    Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object') : [];
  const ids = (value: unknown): string[] => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const bySortOrder = (a: Row, b: Row) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
  /** Only keys the details schema accepts; nulls dropped because some of them are optional but not nullable. */
  const pick = (row: Row, keys: readonly string[]): Row =>
    Object.fromEntries(keys.filter((key) => row[key] != null).map((key) => [key, row[key]]));

  const ROOM_KEYS = ['name', 'room_type', 'short_description', 'max_adults', 'max_children', 'max_guests', 'unit_count'] as const;
  const RATE_KEYS = ['season_type', 'season_name', 'valid_from', 'valid_until', 'currency', 'rack_rate', 'net_rate', 'single_rate', 'double_rate', 'triple_rate', 'child_rate', 'single_supplement', 'pricing_basis', 'meal_plan', 'notes'] as const;
  const SUPPLIER_KEYS = ['supplier_id', 'contact_person', 'reservation_email', 'phone_whatsapp', 'commission_percent', 'contract_start', 'contract_end', 'payment_terms', 'cancellation_terms', 'supplier_preference', 'preferred_supplier', 'personally_inspected', 'last_inspection_date', 'internal_notes', 'contract_document_url'] as const;
  const isStyle = (value: unknown): value is SafariStyle => value === 'budget' || value === 'midrange' || value === 'luxury';

  const preserve = (data: Row): Preserved => ({
    rooms: list(data.rooms).map((room) => ({
      ...pick(room, ROOM_KEYS),
      bed_types: ids(room.bed_types),
      views: ids(room.views),
      amenities: ids(room.amenities),
      // Embedded room images arrive unordered; keep the order they were saved in.
      images: list(room.images ?? room.lodge_room_images).sort(bySortOrder).map((image) => pick(image, ['image_url', 'alt_text', 'caption']))
    })),
    rates: list(data.rates).map((rate) => pick(rate, RATE_KEYS)),
    inclusions: list(data.inclusions)
      .sort(bySortOrder)
      .filter((item) => text(item.title).trim())
      .map((item) => ({ title: text(item.title), is_included: item.is_included !== false })),
    supplier: data.supplier && typeof data.supplier === 'object' ? pick(data.supplier as Row, SUPPLIER_KEYS) : null,
    destination_ids: ids(data.destination_ids),
    tour_ids: ids(data.tour_ids),
    alternative_ids: ids(data.alternative_ids),
    experience_ids: ids(data.experience_ids)
  });

  const loadDetails = async (id: string) => {
    detailsState = 'loading';
    try {
      const res = await api.lodges.details(id);
      const data = (res.data ?? {}) as Row;
      preserved = preserve(data);
      const titles = list(data.highlights).sort(bySortOrder).map((item) => text(item.title).trim()).filter(Boolean);
      form.highlights = titles.length ? titles : [''];
      highlightBaseline = JSON.stringify(titles);
      toursUsing = list(data.tours_using).map((tour) => ({
        id: text(tour.id),
        title: text(tour.title) || 'Untitled tour',
        status: text(tour.status) || 'draft',
        styles: (Array.isArray(tour.styles) ? tour.styles : []).filter(isStyle),
        days: (Array.isArray(tour.days) ? tour.days : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
      }));
      detailsState = 'ready';
    } catch {
      detailsState = 'failed';
    }
  };

  if (editing?.id) void loadDetails(editing.id);

  // ── Gallery + amenities ──────────────────────────────────────────────────
  // The media editor stays mounted in a CSS-hidden panel; its load is kept as
  // a promise so a quick save cannot overwrite the gallery before it arrives.
  let mediaEditor: AdminLodgeMedia | undefined;
  let mediaRequested = false;
  let mediaReady: Promise<void> = Promise.resolve();
  $: if (mediaEditor && !mediaRequested) {
    mediaRequested = true;
    mediaReady = mediaEditor.load(editing?.id ?? null);
  }

  // ── Validation ───────────────────────────────────────────────────────────
  // A number input can hand back a number, '' or null; never call .trim() on it.
  const numberOrNull = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };
  const urlError = (value: string, label: string) => {
    const raw = value.trim();
    if (!raw) return '';
    try {
      return /^https?:$/.test(new URL(raw).protocol) ? '' : `${label} must be a web address starting with https://.`;
    } catch {
      return `${label} must be a full web address, e.g. https://…`;
    }
  };
  const cleanHighlights = () => form.highlights.map((item) => String(item ?? '').trim()).filter(Boolean);

  $: nameError = form.name.trim().length < 2 ? 'Give the property a name of at least 2 characters.' : '';
  $: slugError =
    form.slug.trim().length < 2 || !SLUG_RE.test(form.slug.trim())
      ? 'Page URL: lowercase letters, numbers and single hyphens, e.g. serengeti-safari-lodge.'
      : '';
  $: levelError = LODGE_LEVELS.some((level) => level.value === form.accommodation_level) ? '' : 'Choose a comfort level.';
  $: publishNeedsDestination = form.status === 'published' && !form.destination_id;
  $: publishNeedsShort = form.status === 'published' && !form.short_description.trim();
  $: shortError = form.short_description.length > 500 ? 'Keep the short description to 500 characters or fewer.' : '';
  $: highlightsError = form.highlights.some((item) => String(item ?? '').trim().length > 180) ? 'Keep each highlight to 180 characters or fewer.' : '';
  $: latitude = numberOrNull(form.latitude);
  $: longitude = numberOrNull(form.longitude);
  $: latError = Number.isNaN(latitude) || (latitude != null && Math.abs(latitude) > 90) ? 'Latitude is a number between -90 and 90.' : '';
  $: lngError = Number.isNaN(longitude) || (longitude != null && Math.abs(longitude) > 180) ? 'Longitude is a number between -180 and 180.' : '';
  $: nights = numberOrNull(form.recommended_nights);
  $: nightsError = nights != null && (!Number.isInteger(nights) || nights < 1 || nights > 30) ? 'Recommended nights is a whole number from 1 to 30.' : '';
  $: childAge = form.children === 'yes' ? numberOrNull(form.minimum_child_age) : null;
  $: childAgeError = childAge != null && (!Number.isInteger(childAge) || childAge < 0 || childAge > 18) ? 'Minimum child age is a whole number from 0 to 18.' : '';
  $: price = numberOrNull(form.price_per_night_from);
  $: priceError = Number.isNaN(price) || (price != null && price < 0) ? 'Enter the rate as a number, e.g. 450, or leave it blank.' : '';
  $: currencyError = /^[A-Za-z]{3}$/.test(form.currency.trim()) ? '' : 'Currency is a 3-letter code, e.g. USD.';
  $: heroError = urlError(form.hero_image_url, 'Hero image');
  $: cardError = urlError(form.image_url, 'Card image');
  $: socialError = urlError(form.social_image_url, 'Social image');
  $: tabError = {
    basics: attemptedSave && Boolean(nameError || slugError || levelError || publishNeedsDestination),
    about: Boolean(shortError || highlightsError) || (attemptedSave && publishNeedsShort),
    location: Boolean(latError || lngError || nightsError || childAgeError),
    media: Boolean(heroError || cardError),
    rates: Boolean(priceError || currencyError),
    seo: Boolean(socialError),
    translations: false
  } as Record<TabKey, boolean>;

  // ── Tours that stay here ─────────────────────────────────────────────────
  const daysLabel = (days: number[]) => (!days.length ? '' : days.length === 1 ? `Day ${days[0]}` : `Days ${days.join(', ')}`);
  $: mismatched = toursUsing.some((tour) => tour.styles.some((style) => style !== lodgeStyle));

  // ── Navigation ───────────────────────────────────────────────────────────
  const selectTab = (tab: TabKey) => {
    activeTab = tab;
    // Each step starts at its own top rather than inheriting the last one's scroll.
    bodyEl?.scrollTo({ top: 0 });
  };
  const toast = (message: string, type: 'error' | 'success' = 'success') => dispatch('toast', { message, type });
  /** Save blocked by a field the operator cannot see: go to it, then explain. */
  const failOn = (tab: TabKey, message: string) => {
    selectTab(tab);
    toast(message, 'error');
  };

  const toggleBestFor = (value: string) => {
    const next = new Set(form.best_for);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    form.best_for = BEST_FOR.filter((item) => next.has(item));
  };

  const addHighlight = () => {
    if (form.highlights.length < MAX_HIGHLIGHTS) form.highlights = [...form.highlights, ''];
  };
  // Enter in a highlight line starts the next line, like a list; it must never submit the whole property.
  const highlightKeydown = async (event: KeyboardEvent, index: number) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    if (form.highlights.length >= MAX_HIGHLIGHTS) return;
    form.highlights = [...form.highlights.slice(0, index + 1), '', ...form.highlights.slice(index + 1)];
    await tick();
    (document.querySelector(`[data-highlight="${index + 1}"]`) as HTMLInputElement | null)?.focus();
  };
  const removeHighlight = (index: number) => {
    const next = form.highlights.filter((_, i) => i !== index);
    form.highlights = next.length ? next : [''];
  };
  const moveHighlight = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= form.highlights.length) return;
    const next = [...form.highlights];
    [next[index], next[target]] = [next[target], next[index]];
    form.highlights = next;
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  // Only fields the lodges schema accepts; fields this editor no longer shows
  // (rooms, settings, supplier…) are left out so an update keeps them as stored.
  const payload = () => {
    const blankToNull = (value: string) => value.trim() || null;
    return {
      name: form.name.trim(),
      slug: form.slug.trim(),
      lodge_type: form.lodge_type,
      accommodation_level: form.accommodation_level,
      destination_id: form.destination_id || null,
      status: form.status,
      is_featured: form.is_featured,
      show_property_publicly: form.show_property_publicly,
      short_description: blankToNull(form.short_description),
      description: hasRichContent(form.description) ? form.description : null,
      why_we_recommend: hasRichContent(form.why_we_recommend) ? form.why_we_recommend : null,
      best_for: form.best_for,
      country: form.country || null,
      park_area: blankToNull(form.park_area),
      region: blankToNull(form.region),
      latitude,
      longitude,
      nearest_airport: blankToNull(form.nearest_airport),
      transfer_time: blankToNull(form.transfer_time),
      recommended_nights: nights,
      children_allowed: form.children === '' ? null : form.children === 'yes',
      minimum_child_age: childAge,
      hero_image_url: blankToNull(form.hero_image_url),
      image_url: blankToNull(form.image_url),
      price_per_night_from: price,
      currency: form.currency.trim().toUpperCase(),
      show_rates_publicly: form.show_rates_publicly,
      seo_title: blankToNull(form.seo_title),
      meta_description: blankToNull(form.meta_description),
      social_image_url: blankToNull(form.social_image_url),
      indexable: form.indexable
    };
  };

  /**
   * Highlights live in the details tables, and that endpoint rewrites all of
   * them. So it is only called when the highlights actually changed, and only
   * once the existing details were loaded to send back.
   */
  const saveHighlights = async (id: string) => {
    const titles = cleanHighlights();
    if (detailsState !== 'ready' || JSON.stringify(titles) === highlightBaseline) return;
    await api.lodges.saveDetails(id, { highlights: titles.map((title) => ({ title })), ...preserved });
    highlightBaseline = JSON.stringify(titles);
  };

  const save = async () => {
    if (saving) return;
    attemptedSave = true;
    // Each guard names the step that owns the field, so a blocked save moves
    // the editor there instead of just refusing.
    if (nameError) return failOn('basics', nameError);
    if (slugError) return failOn('basics', slugError);
    if (levelError) return failOn('basics', levelError);
    if (publishNeedsDestination) return failOn('basics', 'Choose a destination before publishing — or save it as a draft.');
    if (shortError) return failOn('about', shortError);
    if (publishNeedsShort) return failOn('about', 'Add a short description before publishing — or save it as a draft.');
    if (highlightsError) return failOn('about', highlightsError);
    if (latError) return failOn('location', latError);
    if (lngError) return failOn('location', lngError);
    if (nightsError) return failOn('location', nightsError);
    if (childAgeError) return failOn('location', childAgeError);
    if (heroError) return failOn('media', heroError);
    if (cardError) return failOn('media', cardError);
    if (priceError) return failOn('rates', priceError);
    if (currencyError) return failOn('rates', currencyError);
    if (socialError) return failOn('seo', socialError);

    saving = true;
    const creating = !savedId;
    try {
      if (savedId) {
        await api.lodges.update(savedId, payload());
      } else {
        const res = await api.lodges.create(payload());
        savedId = String((res.data as { id?: string } | null)?.id ?? '');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Unable to save the property.', 'error');
      saving = false;
      return;
    }

    // The property itself is saved; photos and highlights need its id. A
    // failure here keeps the editor open so a retry updates the same record.
    const problems: string[] = [];
    try {
      await mediaReady;
      await mediaEditor?.save(savedId);
    } catch (e) {
      problems.push(`Photos: ${e instanceof Error ? e.message : 'the gallery did not save.'}`);
    }
    try {
      await saveHighlights(savedId);
    } catch (e) {
      problems.push(`Highlights: ${e instanceof Error ? e.message : 'they did not save.'}`);
    }
    saving = false;

    if (problems.length) {
      toast(`The property saved, but not everything did. ${problems.join(' ')}`, 'error');
      dispatch('saved', { close: false, message: '' });
      return;
    }
    dispatch('saved', { close: true, message: creating ? 'Property created.' : 'Property updated.' });
  };

  const close = () => dispatch('close');

  $: saveNote =
    form.status === 'draft'
      ? 'Draft · Not visible on your website'
      : form.status === 'hidden'
        ? 'Hidden · Not listed on your website'
        : form.status === 'archived'
          ? 'Archived · Hidden from your website'
          : form.show_property_publicly
            ? 'Changes will be visible on your website'
            : 'Published · Its own page is switched off';
</script>

<CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) close(); }}>
  <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog cms-category-dialog gap-0 p-0 overflow-hidden" style="width:min(calc(100vw - 2rem),72rem);max-width:none">
    <CmsDialog.Title class="sr-only">{editing ? editing.name : 'Add a lodge or camp'}</CmsDialog.Title>
    <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
    <form class="cms-editor-form" novalidate on:submit|preventDefault={save}>
      <header class="cms-editor-header"><div class="flex items-center gap-3"><span class="cms-editor-emblem"><Hotel size={20} /></span><div><p>PROPERTY EDITOR</p><h2>{editing ? editing.name : savedId ? form.name : 'Add a lodge or camp'}</h2></div></div><div class="flex items-center gap-4"><StatusBadge status={form.status} /><CmsButton variant="ghost" size="icon" aria-label="Close property editor" onclick={close}><X size={19} /></CmsButton></div></header>
      <div class="cms-editor-workspace">
        <EditorNavigation sections={visibleTabs} active={activeTab} errors={tabError} onNavigate={(key) => selectTab(key as TabKey)} />
        <div class="cms-editor-canvas" bind:this={bodyEl}>
          <div class="cms-editor-section-heading"><p>STEP {String(stepIndex + 1).padStart(2, '0')} / {String(visibleTabs.length).padStart(2, '0')}</p><h3>{visibleTabs[stepIndex]?.[2]}</h3><span>{STEP_HINTS[activeTab]}</span></div>

          <!--
            Panels are CSS-hidden, never unmounted: rich-text editors keep their
            state, AdminLodgeMedia keeps its loaded gallery for the save, and
            AdminTranslationTabs does not refetch over a draft.
          -->

          <!-- ── Essentials ─────────────────────────────────────────────── -->
          <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'basics'}>
            <section class="cms-form-section grid gap-5">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">The property</p>
              <div class="grid gap-4 md:grid-cols-2">
                <div class="grid gap-1.5">
                  <AdminFormInput label="Property name" name="name" required bind:value={form.name} placeholder="e.g. Serengeti Safari Lodge" />
                  {#if attemptedSave && nameError}<span class="text-[11px] font-semibold text-clay">{nameError}</span>{/if}
                </div>
                <CmsLabel class="grid gap-1.5">
                  <span class="text-[13px] font-semibold text-ink/65">Page URL</span>
                  <CmsInput class="h-11 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20" name="slug" bind:value={form.slug} oninput={() => (slugManuallyEdited = true)} />
                  {#if attemptedSave && slugError}<span class="text-[11px] font-semibold text-clay">{slugError}</span>{:else}<span class="text-[11px] text-ink/40">Auto-generated from the name until you edit it.</span>{/if}
                </CmsLabel>
              </div>

              <div class="grid gap-2">
                <span class="text-[13px] font-semibold text-ink/65">Property type</span>
                <div class="flex flex-wrap gap-2" role="group" aria-label="Property type">
                  {#each PROPERTY_TYPES as type (type.value)}
                    {@const picked = form.lodge_type === type.value}
                    {@const Icon = type.icon}
                    <CmsButton variant="ghost" type="button" aria-pressed={picked} class={`h-9 gap-1.5 rounded-full border px-3 text-xs font-bold transition ${picked ? 'border-deep-green bg-deep-green text-white hover:bg-deep-green hover:text-white' : 'border-ink/15 bg-surface text-ink/65 hover:border-forest/40 hover:text-heading'}`} onclick={() => (form.lodge_type = type.value)}>
                      <Icon size={14} aria-hidden="true" />{type.label}
                    </CmsButton>
                  {/each}
                </div>
              </div>
            </section>

            <section class="cms-form-section grid gap-4">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Comfort level</p>
                <p class="mt-1 text-xs text-ink/55">Matches the safari styles on tour prices. In a tour’s itinerary, this property is offered as the overnight for its style.</p>
              </div>
              <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Comfort level">
                {#each LODGE_LEVELS as level (level.value)}
                  {@const theme = SAFARI_STYLE_THEME[level.style]}
                  {@const picked = form.accommodation_level === level.value}
                  {@const Icon = STYLE_ICONS[level.style]}
                  <CmsButton
                    variant="ghost"
                    type="button"
                    aria-pressed={picked}
                    class={`h-auto flex-col items-stretch justify-start gap-1.5 whitespace-normal rounded-xl border-2 bg-surface p-3 text-left transition hover:bg-surface ${picked ? 'shadow-sm' : 'border-ink/10 hover:border-ink/25'}`}
                    style={picked ? `border-color:${theme.primary};background:${theme.light}` : undefined}
                    onclick={() => (form.accommodation_level = level.value)}
                  >
                    <span class="flex items-center justify-between gap-2">
                      <span class="grid size-9 place-items-center rounded-lg" style={`background:${theme.light};color:${theme.priceColor}`}><Icon size={18} aria-hidden="true" /></span>
                      {#if picked}<span class="grid size-5 place-items-center rounded-full text-white" style={`background:${theme.priceColor}`}><Check size={12} /></span>{/if}
                    </span>
                    <span class="text-sm font-bold text-heading">{level.label}</span>
                    <span class="text-[11px] font-normal leading-4 text-ink/55">{level.hint}</span>
                    <span class="mt-auto pt-1 text-[11px] font-semibold text-heading">Used for {STYLE_NAMES[level.style]} safaris</span>
                  </CmsButton>
                {/each}
              </div>
              {#if attemptedSave && levelError}<span class="text-[11px] font-semibold text-clay">{levelError}</span>{/if}
            </section>

            <!-- Publishing sits on Essentials: status arms the publish checks, so it should be in view while working here. -->
            <section class="cms-form-section grid gap-5">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Where & publishing</p>
              <div class="grid gap-4 md:grid-cols-2">
                <div class="grid gap-1.5">
                  <AdminSelect label="Destination" name="destination_id" bind:value={form.destination_id} options={destinationOptions} />
                  {#if attemptedSave && publishNeedsDestination}<span class="text-[11px] font-semibold text-clay">Choose a destination before publishing.</span>{/if}
                </div>
                <AdminSelect label="Status" name="status" bind:value={form.status} options={LODGE_STATUSES} />
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <CmsLabel class="flex items-center gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
                  <Switch bind:checked={form.is_featured} aria-label="Featured property" />
                  Featured property
                </CmsLabel>
                <CmsLabel class="flex items-center gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
                  <Switch bind:checked={form.show_property_publicly} aria-label="Show on website" />
                  Show on website
                </CmsLabel>
              </div>
              <p class="-mt-2 text-xs text-ink/45">Publishing needs a destination and a short description. Featured properties are shown first. With Show on website off, the property has no page of its own and is left out of the sitemap.</p>
            </section>
          </div>

          <!-- ── About the stay ─────────────────────────────────────────── -->
          <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'about'}>
            <section class="cms-form-section grid gap-5">
              <div class="grid gap-1.5">
                <AdminTextArea label="Short description" name="short_description" bind:value={form.short_description} rows={3} counter={500} placeholder="One or two sentences for cards and itinerary days." />
                {#if shortError}<span class="text-[11px] font-semibold text-clay">{shortError}</span>{:else if attemptedSave && publishNeedsShort}<span class="text-[11px] font-semibold text-clay">Add a short description before publishing.</span>{/if}
              </div>
              <AdminRichText label="Description" name="description" bind:value={form.description} rows={8} placeholder="The setting, the rooms or tents, the food and the feel of the place." />
              <AdminRichText label="Why we recommend it" name="why_we_recommend" bind:value={form.why_we_recommend} rows={4} headings="none" placeholder="Our honest take — who will love it, and why we send guests here." />
            </section>

            <section class="cms-form-section grid gap-3">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Property highlights</p>
                  <p class="mt-1 text-xs text-ink/55">One short point per line, in the order shown — up to {MAX_HIGHLIGHTS}. Empty lines are ignored.</p>
                </div>
                <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink disabled:opacity-40" disabled={detailsState !== 'ready' || form.highlights.length >= MAX_HIGHLIGHTS} onclick={addHighlight}><Plus size={14} />Add</CmsButton>
              </div>
              {#if detailsState === 'loading'}
                <p class="rounded-md bg-sand/45 px-3 py-3 text-sm text-ink/60">Loading highlights…</p>
              {:else if detailsState === 'failed'}
                <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">The highlights could not be loaded, so they are left as they are. Close and reopen the property to edit them.</p>
              {:else}
                {#each form.highlights as _item, index}
                  <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <CmsInput class="h-11 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20" aria-label={`Highlight ${index + 1}`} data-highlight={index} onkeydown={(event) => highlightKeydown(event, index)} maxlength={180} placeholder={index === 0 ? 'e.g. Tents facing the Grumeti River' : ''} bind:value={form.highlights[index]} />
                    <div class="flex gap-1.5">
                      <CmsButton variant="ghost" type="button" class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 disabled:opacity-30" aria-label={`Move highlight ${index + 1} up`} disabled={index === 0} onclick={() => moveHighlight(index, -1)}><ArrowUp size={14} /></CmsButton>
                      <CmsButton variant="ghost" type="button" class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 disabled:opacity-30" aria-label={`Move highlight ${index + 1} down`} disabled={index === form.highlights.length - 1} onclick={() => moveHighlight(index, 1)}><ArrowDown size={14} /></CmsButton>
                      <CmsButton variant="ghost" type="button" class="inline-flex h-10 items-center rounded-md border border-red-200 bg-surface px-3 text-red-700 hover:bg-red-50" aria-label={`Remove highlight ${index + 1}`} onclick={() => removeHighlight(index)}><Trash2 size={14} /></CmsButton>
                    </div>
                  </div>
                {/each}
                {#if highlightsError}<span class="text-[11px] font-semibold text-clay">{highlightsError}</span>{/if}
              {/if}
            </section>

            <section class="cms-form-section grid gap-3">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Best for</p>
                <p class="mt-1 text-xs text-ink/55">Tick the travellers this stay suits. Leave all unticked if it suits everyone.</p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                {#each BEST_FOR as value (value)}
                  {@const selected = form.best_for.includes(value)}
                  <CmsButton variant="ghost" type="button" aria-pressed={selected} class={`h-9 rounded-full border px-3 text-xs font-bold transition ${selected ? 'border-deep-green bg-deep-green text-white hover:bg-deep-green hover:text-white' : 'border-ink/15 bg-surface text-ink/65 hover:border-forest/40 hover:text-heading'}`} onclick={() => toggleBestFor(value)}>{BEST_FOR_LABELS[value] ?? value}</CmsButton>
                {/each}
              </div>
            </section>
          </div>

          <!-- ── Location & practical ───────────────────────────────────── -->
          <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'location'}>
            <section class="cms-form-section grid gap-5">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Where it is</p>
              <div class="grid gap-4 md:grid-cols-3">
                <AdminSelect label="Country" name="country" bind:value={form.country} options={[{ label: 'Not set', value: '' }, ...EAST_AFRICA_COUNTRIES.map((country) => ({ label: country, value: country }))]} />
                <AdminFormInput label="Region" name="region" bind:value={form.region} placeholder="e.g. Mara Region" />
                <AdminFormInput label="Park or area" name="park_area" bind:value={form.park_area} placeholder="e.g. Central Serengeti" />
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-1.5">
                  <AdminFormInput label="Latitude" name="latitude" type="number" step="any" bind:value={form.latitude} placeholder="-2.3333" />
                  {#if latError}<span class="text-[11px] font-semibold text-clay">{latError}</span>{/if}
                </div>
                <div class="grid gap-1.5">
                  <AdminFormInput label="Longitude" name="longitude" type="number" step="any" bind:value={form.longitude} placeholder="34.8333" />
                  {#if lngError}<span class="text-[11px] font-semibold text-clay">{lngError}</span>{/if}
                </div>
              </div>
              <p class="-mt-2 text-xs text-ink/45">Optional. Decimal degrees — south of the equator is negative.</p>
            </section>

            <section class="cms-form-section grid gap-5">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Getting there</p>
              <div class="grid gap-4 md:grid-cols-2">
                <AdminFormInput label="Nearest airport or airstrip" name="nearest_airport" bind:value={form.nearest_airport} placeholder="e.g. Seronera Airstrip" />
                <AdminFormInput label="Transfer time" name="transfer_time" bind:value={form.transfer_time} placeholder="e.g. About 45 minutes by road" />
              </div>
            </section>

            <section class="cms-form-section grid gap-5">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Planning the stay</p>
              <div class="grid gap-4 md:grid-cols-3">
                <div class="grid gap-1.5">
                  <AdminFormInput label="Recommended nights" name="recommended_nights" type="number" min={1} bind:value={form.recommended_nights} placeholder="2" />
                  {#if nightsError}<span class="text-[11px] font-semibold text-clay">{nightsError}</span>{/if}
                </div>
                <AdminSelect label="Children" name="children" bind:value={form.children} options={CHILDREN_OPTIONS} />
                {#if form.children === 'yes'}
                  <div class="grid gap-1.5">
                    <AdminFormInput label="Minimum child age" name="minimum_child_age" type="number" min={0} bind:value={form.minimum_child_age} placeholder="6" />
                    {#if childAgeError}<span class="text-[11px] font-semibold text-clay">{childAgeError}</span>{/if}
                  </div>
                {/if}
              </div>
            </section>
          </div>

          <!-- ── Photos ─────────────────────────────────────────────────── -->
          <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'media'}>
            <section class="cms-form-section grid gap-5 lg:grid-cols-2">
              <div class="grid content-start gap-3">
                <div><h3 class="text-base font-semibold text-ink">Hero image</h3><p class="mt-1 text-sm text-ink/55">Wide photo at the top of the property page.</p></div>
                <MediaPicker label="Hero image" uploadFolder="lodges" aspect="aspect-[16/9]" bind:value={form.hero_image_url} />
                {#if heroError}<span class="text-[11px] font-semibold text-clay">{heroError}</span>{/if}
              </div>
              <div class="grid content-start gap-3">
                <div><h3 class="text-base font-semibold text-ink">Card image</h3><p class="mt-1 text-sm text-ink/55">Used on property cards and itinerary days. Falls back to the gallery cover.</p></div>
                <MediaPicker label="Card image" uploadFolder="lodges" aspect="aspect-[4/3]" bind:value={form.image_url} />
                {#if cardError}<span class="text-[11px] font-semibold text-clay">{cardError}</span>{/if}
              </div>
            </section>
            <section class="cms-form-section grid gap-3">
              <AdminLodgeMedia bind:this={mediaEditor} />
              <p class="text-xs text-ink/45">The gallery and amenities save with the property.</p>
            </section>
          </div>

          <!-- ── Rates & tours ──────────────────────────────────────────── -->
          <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'rates'}>
            <section class="cms-form-section grid gap-4">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Nightly rate</p>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-1.5">
                  <AdminFormInput label="Price per night from" name="price_per_night_from" type="number" min={0} step="any" bind:value={form.price_per_night_from} placeholder="450" />
                  {#if priceError}<span class="text-[11px] font-semibold text-clay">{priceError}</span>{/if}
                </div>
                <div class="grid gap-1.5">
                  <AdminFormInput label="Currency" name="currency" bind:value={form.currency} placeholder="USD" />
                  {#if currencyError}<span class="text-[11px] font-semibold text-clay">{currencyError}</span>{/if}
                </div>
              </div>
              <CmsLabel class="flex items-center gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
                <Switch bind:checked={form.show_rates_publicly} aria-label="Show rates publicly" />
                Show rates publicly
              </CmsLabel>
              <p class="-mt-1 text-xs text-ink/45">An indicative starting rate for planners. Leave it blank to show no price. Tour prices are set per safari style in <a class="font-semibold text-forest underline-offset-2 hover:underline" href="/admin/pricing-options" target="_blank" rel="noopener">Pricing options</a>.</p>
            </section>

            <section class="cms-form-section grid gap-4">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Used in tours</p>
                  <p class="mt-1 text-xs text-ink/55">Read only. A tour adds this property in its itinerary, where each day has an Overnight for every safari style.</p>
                </div>
                <StyleBadge style={lodgeStyle} label={`${STYLE_NAMES[lodgeStyle]} overnight`} />
              </div>

              {#if !savedId}
                <p class="rounded-md border border-dashed border-ink/20 px-3 py-4 text-sm text-ink/55">Once a tour’s itinerary uses this property as an overnight, the tour appears here.</p>
              {:else if detailsState === 'loading'}
                <p class="rounded-md bg-sand/45 px-3 py-3 text-sm text-ink/60">Loading tours…</p>
              {:else if detailsState === 'failed'}
                <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">The tours using this property could not be loaded.</p>
              {:else if !toursUsing.length}
                <p class="rounded-md border border-dashed border-ink/20 px-3 py-4 text-sm text-ink/55">No tour stays here yet. In a tour’s itinerary, pick this property as the {STYLE_NAMES[lodgeStyle]} overnight for a day.</p>
              {:else}
                <ul class="grid gap-2">
                  {#each toursUsing as tour (tour.id)}
                    <li class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-ink/10 bg-surface px-3 py-2.5">
                      <div class="min-w-0 flex-1 basis-48">
                        <a class="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink hover:text-forest" href={`/admin/tours/${tour.id}/edit`} target="_blank" rel="noopener">
                          <span class="truncate">{tour.title}</span><ExternalLink size={12} class="shrink-0 text-ink/40" />
                        </a>
                        {#if tour.days.length}<p class="mt-0.5 text-[11px] text-ink/50">{daysLabel(tour.days)}</p>{/if}
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5">
                        {#each tour.styles as style (style)}
                          <StyleBadge {style} label={STYLE_NAMES[style]} warn={style !== lodgeStyle} />
                        {:else}
                          <span class="rounded-full border border-ink/15 px-2 py-0.5 text-[11px] font-semibold text-ink/60">All styles</span>
                        {/each}
                        <StatusBadge status={tour.status} />
                      </div>
                    </li>
                  {/each}
                </ul>
                {#if mismatched}
                  <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Ringed styles use this property for a style other than {STYLE_NAMES[lodgeStyle]}. Change the overnight in that tour, or the comfort level on Essentials.</p>
                {/if}
              {/if}
            </section>
          </div>

          <!-- ── Search & sharing ───────────────────────────────────────── -->
          <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'seo'}>
            <section class="cms-form-section grid gap-5">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="grid content-start gap-4">
                  <AdminFormInput label="SEO title" name="seo_title" bind:value={form.seo_title} counter={60} placeholder="Falls back to the property name." />
                  <AdminTextArea label="Meta description" name="meta_description" bind:value={form.meta_description} rows={3} counter={160} placeholder="Falls back to the short description." />
                </div>
                <div class="grid content-start gap-1.5">
                  <MediaPicker label="Social / Open Graph image" uploadFolder="lodges/seo" aspect="aspect-[16/9]" bind:value={form.social_image_url} />
                  {#if socialError}<span class="text-[11px] font-semibold text-clay">{socialError}</span>{/if}
                </div>
              </div>
              <CmsLabel class="flex items-center gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
                <Switch bind:checked={form.indexable} aria-label="Let search engines index this page" />
                Let search engines index this page
              </CmsLabel>
              <p class="-mt-2 text-xs text-ink/45">All optional. Empty fields fall back to the property name, short description and hero image.</p>
            </section>
          </div>

          <!-- ── Translations (saved properties only — needs an id) ─────── -->
          {#if savedId}
            <div class:hidden={activeTab !== 'translations'}>
              <AdminTranslationTabs entityType="lodges" entityId={savedId} on:toast={(event) => toast(event.detail.message, event.detail.type ?? 'success')} />
            </div>
          {/if}
        </div>
      </div>
      <footer class="cms-editor-footer">
        <span class="cms-save-note">{saveNote}</span>
        <div class="cms-editor-footer-actions">
          {#if stepIndex > 0}<CmsButton variant="ghost" class="cms-editor-back" aria-label="Previous section" onclick={() => selectTab(visibleTabs[stepIndex - 1][0])}><ArrowLeft size={14} /><span>Back</span></CmsButton>{/if}
          {#if stepIndex < visibleTabs.length - 1}<CmsButton variant="outline" onclick={() => selectTab(visibleTabs[stepIndex + 1][0])}>Continue<ArrowRight size={14} /></CmsButton>{/if}
          <CmsButton variant="default" type="submit" disabled={saving} class="gap-2 px-5"><Save size={14} />{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : savedId ? 'Save changes' : 'Create property'}</CmsButton>
        </div>
      </footer>
    </form>
  </CmsDialog.Content>
</CmsDialog.Root>
