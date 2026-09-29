<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';
  import { Input as CmsInput } from '$lib/components/ui/input';

  import { onMount } from 'svelte';
  import type { Component } from 'svelte';
  import {
    Archive,
    BarChart3,
    Bot,
    CalendarX,
    ClipboardList,
    Coins,
    FileText,
    Info,
    Languages,
    MapPin,
    Palette,
    Plus,
    Save,
    Scale,
    Search,
    Share2,
    ShieldCheck,
    RotateCcw,
    Trash2,
    Plug,
    MessageCircle
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import { legalSettingKey, type LegalDefaults, type LegalDocKey, type LegalPart } from '$lib/admin/legal';
  import AdminTranslationTabs from '$lib/admin/components/admin/AdminTranslationTabs.svelte';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type FieldType = 'boolean' | 'color' | 'currency-list' | 'email' | 'image' | 'json' | 'number' | 'phone' | 'rich' | 'select' | 'text' | 'textarea' | 'url';
  // `aspect`/`fit` only apply to type 'image' — a logo must not be cropped the
  // way a social card should be. `legal` marks a part of a legal page: its
  // default is the wording the website already shows, and an empty saved
  // value opens as that wording again, because empty is exactly what the
  // website falls back from.
  type Field = { aspect?: string; default?: unknown; fit?: string; helper?: string; key: string; label: string; legal?: { doc: LegalDocKey; part: LegalPart }; options?: string[]; public: boolean; type: FieldType };
  type Group = { fields: Field[]; icon: Component; key: string; label: string; legalDoc?: LegalDocKey; note?: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  type CurrencySetting = { code: string; name: string; symbol: string; locale: string; decimalDigits: number; enabled: boolean };

  const DEFAULT_CURRENCIES: CurrencySetting[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimalDigits: 2, enabled: true },
    { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE', decimalDigits: 2, enabled: true },
    { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB', decimalDigits: 2, enabled: true },
    { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', locale: 'sw-TZ', decimalDigits: 0, enabled: true },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', locale: 'en-KE', decimalDigits: 0, enabled: true },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA', decimalDigits: 2, enabled: true },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU', decimalDigits: 2, enabled: true },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', locale: 'en-CA', decimalDigits: 2, enabled: true }
  ];

  const GROUPS: Group[] = [
    { key: 'brand', label: 'Brand', icon: Palette, fields: [
      { key: 'site_name', label: 'Site name', type: 'text', public: true, default: 'Key2africa Safaris' },
      { key: 'company_name', label: 'Company name', type: 'text', public: true, default: 'Key2africa Tours and Safaris ltd' },
      { key: 'tagline', label: 'Tagline', type: 'text', public: true, default: "Africa's Most Trusted Travel Planning Brand" },
      { key: 'brand_statement', label: 'Brand statement', type: 'textarea', public: true, default: 'Travelers do not need more options. They need more confidence.' },
      { key: 'logo_url', label: 'Logo', type: 'image', public: true, helper: 'Public logo image.', aspect: 'aspect-square', fit: 'object-contain' },
      { key: 'favicon_url', label: 'Favicon', type: 'image', public: true, aspect: 'aspect-square', fit: 'object-contain' },
      { key: 'primary_color', label: 'Primary color', type: 'color', public: true, default: '#2D3027' },
      { key: 'secondary_color', label: 'Secondary color', type: 'color', public: true, default: '#393D32' },
      { key: 'accent_color', label: 'Accent color', type: 'color', public: true, default: '#E4A92E' }
    ] },
    { key: 'contact', label: 'Contact', icon: MapPin, fields: [
      { key: 'contact_email', label: 'Contact email', type: 'email', public: true },
      { key: 'contact_phone', label: 'Contact phone', type: 'phone', public: true },
      { key: 'whatsapp_number', label: 'WhatsApp number', type: 'phone', public: true },
      { key: 'office_address', label: 'Office address', type: 'text', public: true },
      { key: 'city', label: 'City', type: 'text', public: true },
      { key: 'country', label: 'Country', type: 'text', public: true },
      { key: 'google_maps_url', label: 'Google Maps URL', type: 'url', public: true },
      { key: 'business_hours', label: 'Business hours', type: 'text', public: true }
    ] },
    { key: 'social', label: 'Social', icon: Share2, fields: [
      { key: 'facebook_url', label: 'Facebook', type: 'url', public: true },
      { key: 'instagram_url', label: 'Instagram', type: 'url', public: true },
      { key: 'youtube_url', label: 'YouTube', type: 'url', public: true },
      { key: 'tiktok_url', label: 'TikTok', type: 'url', public: true },
      { key: 'linkedin_url', label: 'LinkedIn', type: 'url', public: true },
      { key: 'tripadvisor_url', label: 'TripAdvisor', type: 'url', public: true }
    ] },
    { key: 'seo', label: 'SEO', icon: Search, fields: [
      { key: 'default_meta_title', label: 'Default meta title', type: 'text', public: true },
      { key: 'default_meta_description', label: 'Default meta description', type: 'textarea', public: true },
      { key: 'default_og_image_url', label: 'Default OG image', type: 'image', public: true, aspect: 'aspect-[1.91/1]' },
      { key: 'canonical_base_url', label: 'Canonical base URL', type: 'url', public: true },
      { key: 'robots_indexing_enabled', label: 'Allow search engine indexing', type: 'boolean', public: true, default: true }
    ] },
    { key: 'booking', label: 'Booking', icon: ClipboardList, fields: [
      { key: 'booking_enabled', label: 'Booking enabled', type: 'boolean', public: true, default: true },
      { key: 'booking_success_message', label: 'Booking success message', type: 'textarea', public: true },
      { key: 'default_response_time_message', label: 'Response time message', type: 'text', public: true },
      { key: 'require_phone_number', label: 'Require phone number', type: 'boolean', public: true },
      { key: 'allow_general_plan_my_trip', label: 'Allow general Plan My Trip', type: 'boolean', public: true, default: true },
      // Not public: these are composing defaults for the team, not something a
      // website visitor should be able to read off the settings endpoint.
      { key: 'default_deposit_percent', label: 'Default deposit %', type: 'number', public: false, default: 30, helper: 'Pre-fills the deposit on a new quotation from its total. The agent can always change it.' },
      { key: 'default_payment_terms', label: 'Default payment terms', type: 'textarea', public: false, helper: 'Pre-fills the payment terms on a new quotation, and the how-to-pay text when you request payment. e.g. 30% deposit to confirm, balance due 60 days before travel. M-Pesa to 0754 000 000.' }
    ] },
    { key: 'currencies', label: 'Currencies', icon: Coins, note: 'All package prices stay stored in USD. Enabled currencies are fetched from Open Exchange Rates during the scheduled backend refresh.', fields: [
      { key: 'default_currency', label: 'Default currency', type: 'select', public: true, default: 'USD', helper: 'Used only when a visitor has not chosen a currency yet.' },
      { key: 'supported_currencies', label: 'Supported currencies', type: 'currency-list', public: false, default: DEFAULT_CURRENCIES, helper: 'Add valid 3-letter ISO currency codes supported by Open Exchange Rates. USD must stay enabled.' }
    ] },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, fields: [
      { key: 'whatsapp_enabled', label: 'WhatsApp CTA enabled', type: 'boolean', public: true, default: true },
      { key: 'whatsapp_button_text', label: 'Button text', type: 'text', public: true, default: 'Chat on WhatsApp' },
      { key: 'whatsapp_default_message', label: 'Default message', type: 'textarea', public: true },
      { key: 'whatsapp_display_pages', label: 'Display pages', type: 'json', public: true, helper: 'JSON array of page keys, e.g. ["home","tours","contact"].' }
    ] },
    { key: 'ai', label: 'AI Advisor', icon: Bot, note: 'The Anthropic API key is managed securely in backend environment variables — never here.', fields: [
      { key: 'ai_enabled', label: 'AI advisor enabled', type: 'boolean', public: true, default: true },
      { key: 'ai_widget_enabled', label: 'Show AI chat widget', type: 'boolean', public: true, default: true },
      { key: 'ai_display_name', label: 'AI display name', type: 'text', public: true, default: 'Key2africa Travel Advisor' },
      { key: 'ai_intro_message', label: 'AI intro message', type: 'textarea', public: true },
      { key: 'ai_handoff_message', label: 'AI handoff message', type: 'textarea', public: true },
      { key: 'ai_status_label', label: 'AI status label', type: 'text', public: true, default: 'Online' }
    ] },
    { key: 'hubspot', label: 'HubSpot', icon: Plug, note: 'The HubSpot access token is managed securely in backend environment variables — never here.', fields: [
      { key: 'hubspot_enabled', label: 'HubSpot enabled', type: 'boolean', public: false },
      { key: 'hubspot_sync_enabled', label: 'Sync leads & bookings', type: 'boolean', public: false },
      { key: 'hubspot_pipeline_name', label: 'Pipeline name', type: 'text', public: false, default: 'Sales Pipeline' }
    ] },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, fields: [
      { key: 'ga4_measurement_id', label: 'GA4 measurement ID', type: 'text', public: true, helper: 'e.g. G-XXXXXXXXXX' },
      { key: 'gsc_verification_code', label: 'Search Console verification', type: 'text', public: true },
      { key: 'enable_cookie_notice', label: 'Show cookie notice', type: 'boolean', public: true, default: true }
    ] },
    { key: 'legal', label: 'Legal links', icon: Scale, note: 'Only for pages hosted somewhere else. Leave a link empty to use the page you edit below (Privacy policy, Terms, Cancellation policy, Data retention).', fields: [
      { key: 'privacy_policy_url', label: 'Privacy policy URL', type: 'url', public: true },
      { key: 'terms_url', label: 'Terms URL', type: 'url', public: true },
      { key: 'cancellation_policy_url', label: 'Cancellation policy URL', type: 'url', public: true },
      { key: 'data_retention_url', label: 'Data retention URL', type: 'url', public: true },
      { key: 'data_retention_notice', label: 'Data retention notice', type: 'textarea', public: true, helper: 'Optional short notice shown at the top of the Data retention page.' }
    ] },
    legalGroup('privacy', 'Privacy policy', ShieldCheck),
    legalGroup('terms', 'Terms', FileText),
    legalGroup('cancellation', 'Cancellation policy', CalendarX),
    legalGroup('data_retention', 'Data retention', Archive)
  ];

  /**
   * One legal page. Private settings — the website reads them one page at a
   * time from /api/public/legal/:doc, not in the settings every page loads.
   * Each field's default (the built-in wording) arrives from the server in
   * load(), where the same text is used for the page and its translations.
   */
  function legalGroup(doc: LegalDocKey, label: string, icon: Component): Group {
    const field = (part: LegalPart, label: string, type: FieldType, helper?: string): Field => ({
      key: legalSettingKey(doc, part), label, type, public: false, legal: { doc, part }, helper
    });
    return {
      key: `legal_${doc}`,
      label,
      icon,
      legalDoc: doc,
      note: 'Opens with the text the website shows now. Edit and save to update the page; empty a field to go back to the original wording.',
      fields: [
        field('title', 'Page title', 'text'),
        field('updated', 'Last updated', 'text', 'e.g. September 2026'),
        field('intro', 'Introduction', 'textarea'),
        field('meta_description', 'Search description', 'textarea', 'The summary search engines show under the page title.'),
        field('body', 'Page text', 'rich')
      ]
    };
  }

  // Built-in wording and fixed id of each legal page, from the server.
  let legalDefaults: LegalDefaults | null = null;
  // Bumped on every save so the translation panels re-read the saved English —
  // unless a translation is mid-edit, since re-reading would drop what was typed.
  let savedVersion = 0;
  let legalTranslationUnsaved = false;

  const selectGroup = (key: string) => {
    if (key === activeGroup) return;
    // A legal page's translation panel lives in its section; leaving drops typed text.
    if (legalTranslationUnsaved && !confirm('Discard your unsaved translation changes?')) return;
    activeGroup = key;
  };

  const ALL_FIELDS = GROUPS.flatMap((g) => g.fields);
  const groupOfField = new Map(GROUPS.flatMap((g) => g.fields.map((f) => [f.key, g.key] as const)));
  const fieldByKey = new Map(ALL_FIELDS.map((f) => [f.key, f]));

  let loading = true;
  let saving = false;
  let error = '';
  let activeGroup = 'brand';
  // Holds mixed value types per setting (string, boolean, JSON string) — keyed by setting key.
  let values: Record<string, any> = {};
  let originalSerialized: Record<string, string> = {};
  let toasts: Toast[] = [];

  // media picker

  $: group = GROUPS.find((g) => g.key === activeGroup) ?? GROUPS[0];
  $: dirtyKeys = ALL_FIELDS.filter((f) => JSON.stringify(values[f.key]) !== originalSerialized[f.key]).map((f) => f.key);
  $: hasChanges = dirtyKeys.length > 0;
  $: currencyRows = normalizeCurrencyRows(values.supported_currencies);
  $: enabledCurrencyOptions = currencyRows
    .filter((currency) => currency.enabled)
    .map((currency) => ({ label: `${currency.code} — ${currency.name}`, value: currency.code }));

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };
  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const initialValue = (field: Field) => field.default !== undefined ? clone(field.default) : (field.type === 'boolean' ? false : '');

  const normalizeCurrencyRows = (value: unknown): CurrencySetting[] => {
    const rows = Array.isArray(value) ? value : DEFAULT_CURRENCIES;
    return rows.map((row) => {
      const currency = row as Partial<CurrencySetting>;
      return {
        code: String(currency.code ?? '').trim().toUpperCase(),
        name: String(currency.name ?? '').trim(),
        symbol: String(currency.symbol ?? '').trim(),
        locale: String(currency.locale ?? '').trim() || 'en-US',
        decimalDigits: Number.isFinite(Number(currency.decimalDigits)) ? Number(currency.decimalDigits) : 2,
        enabled: typeof currency.enabled === 'boolean' ? currency.enabled : true
      };
    });
  };

  const setCurrencyRows = (rows: CurrencySetting[]) => {
    values.supported_currencies = rows.map((row) => ({ ...row, code: row.code.trim().toUpperCase() }));
    values = { ...values };
  };

  const updateCurrencyRow = (index: number, patch: Partial<CurrencySetting>) => {
    const rows = normalizeCurrencyRows(values.supported_currencies);
    const current = rows[index];
    if (!current) return;
    rows[index] = {
      ...current,
      ...patch,
      code: patch.code !== undefined ? patch.code.trim().toUpperCase() : current.code
    };
    if (rows[index].code === 'USD') {
      rows[index].enabled = true;
      rows[index].decimalDigits = 2;
    }
    setCurrencyRows(rows);
  };

  const addCurrency = () => {
    const rows = normalizeCurrencyRows(values.supported_currencies);
    rows.push({ code: '', name: '', symbol: '', locale: 'en-US', decimalDigits: 2, enabled: true });
    setCurrencyRows(rows);
  };

  const removeCurrency = (index: number) => {
    const rows = normalizeCurrencyRows(values.supported_currencies);
    if (rows[index]?.code === 'USD') {
      showToast('USD cannot be removed because package prices are stored in USD.', 'error');
      return;
    }
    rows.splice(index, 1);
    setCurrencyRows(rows);
  };

  const load = async () => {
    loading = true;
    error = '';
    try {
      const [res, defaults] = await Promise.all([
        api.settings.list(),
        // Fails soft: without it the legal sections open empty, nothing else changes.
        api.settings.legalDefaults().catch(() => null)
      ]);
      legalDefaults = defaults?.data ?? null;
      for (const field of ALL_FIELDS) {
        if (field.legal) field.default = legalDefaults?.[field.legal.doc]?.[field.legal.part] ?? '';
      }
      const map = new Map((res.data as Array<Record<string, unknown>>).map((s) => [String(s.setting_key), s.setting_value]));
      const next: Record<string, unknown> = {};
      for (const field of ALL_FIELDS) {
        let raw = map.has(field.key) ? map.get(field.key) : initialValue(field);
        // An emptied legal field means "use the original wording" — show that
        // wording, not a blank box that looks like the page is empty.
        if (field.legal && !String(raw ?? '').replace(/<[^>]*>/g, '').trim()) raw = initialValue(field);
        if (field.type === 'json') raw = JSON.stringify(raw ?? [], null, 2);
        if (field.type === 'currency-list') raw = normalizeCurrencyRows(raw);
        next[field.key] = raw;
      }
      values = next;
      originalSerialized = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, JSON.stringify(next[f.key])]));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load settings.';
    } finally {
      loading = false;
    }
  };

  const discard = () => {
    const next: Record<string, unknown> = {};
    for (const f of ALL_FIELDS) next[f.key] = JSON.parse(originalSerialized[f.key]);
    values = next;
    showToast('Changes discarded.');
  };

  const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  const validate = (field: Field, value: unknown): string | null => {
    if (value === '' || value === null || value === undefined) return null;
    if (field.type === 'url' && (typeof value !== 'string' || !/^https?:\/\/.+/.test(value))) return `${field.label} must be a valid URL (https://...).`;
    if (field.type === 'email' && (typeof value !== 'string' || !EMAIL.test(value))) return `${field.label} must be a valid email.`;
    if (field.type === 'color' && (typeof value !== 'string' || !HEX.test(value))) return `${field.label} must be a valid hex color.`;
    if (field.type === 'currency-list') {
      const rows = normalizeCurrencyRows(value);
      const seen = new Set<string>();
      for (const [index, row] of rows.entries()) {
        if (!/^[A-Z]{3}$/.test(row.code)) return `Currency row ${index + 1} needs a valid 3-letter code.`;
        if (seen.has(row.code)) return `${row.code} is duplicated.`;
        if (!row.name) return `${row.code} needs a currency name.`;
        if (!row.symbol) return `${row.code} needs a display symbol.`;
        if (!row.locale) return `${row.code} needs a locale.`;
        if (!Number.isInteger(Number(row.decimalDigits)) || Number(row.decimalDigits) < 0 || Number(row.decimalDigits) > 4) return `${row.code} decimals must be 0 to 4.`;
        seen.add(row.code);
      }
      const usd = rows.find((row) => row.code === 'USD');
      if (!usd) return 'USD must stay in supported currencies.';
      if (!usd.enabled) return 'USD must stay enabled.';
      if (usd.decimalDigits !== 2) return 'USD must use 2 decimal digits.';
    }
    if (field.key === 'default_currency') {
      const selected = String(value ?? '').toUpperCase();
      if (!enabledCurrencyOptions.some((option) => option.value === selected)) return 'Default currency must be one of the enabled currencies.';
    }
    return null;
  };

  const save = async () => {
    const changed = dirtyKeys;
    if (changed.length === 0) return;

    const payloads: { body: Record<string, unknown>; key: string }[] = [];
    for (const key of changed) {
      const field = fieldByKey.get(key);
      if (!field) continue;
      let value: unknown = values[key];
      if (field.type === 'json') {
        try {
          value = JSON.parse(String(values[key] || 'null'));
        } catch {
          showToast(`${field.label} must be valid JSON.`, 'error');
          return;
        }
      }
      if (field.type === 'currency-list') value = normalizeCurrencyRows(value);
      const err = validate(field, value);
      if (err) { showToast(err, 'error'); return; }
      payloads.push({
        key,
        // Rich page text is stored as a textarea setting (an existing type) and
        // sanitised by the server on save.
        body: { setting_value: value, setting_group: groupOfField.get(key) ?? 'general', setting_type: field.type === 'currency-list' ? 'json' : field.type === 'rich' ? 'textarea' : field.type, is_public: field.public }
      });
    }

    saving = true;
    try {
      for (const { key, body } of payloads) {
        await api.settings.update(key, body);
      }
      for (const { key } of payloads) originalSerialized[key] = JSON.stringify(values[key]);
      originalSerialized = { ...originalSerialized };
      if (!legalTranslationUnsaved) savedVersion += 1;
      showToast(`Saved ${payloads.length} setting${payloads.length === 1 ? '' : 's'}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    } finally {
      saving = false;
    }
  };

  onMount(load);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6 pb-24">
  <AdminPageHeader
    eyebrow="Administration"
    title="Website Settings"
    description="Manage safe public configuration, brand details, contact information, SEO defaults, integrations status, and platform preferences."
  />

  {#if loading}
    <LoadingState message="Loading settings..." />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <div class="grid gap-5 lg:grid-cols-[240px_1fr] lg:items-start">
      <!-- group nav -->
      <nav class="flex gap-2 overflow-x-auto rounded-2xl border border-ink/10 bg-surface p-2 shadow-sm lg:sticky lg:top-24 lg:flex-col lg:overflow-visible">
        {#each GROUPS as g}
          {@const Icon = g.icon}
          {@const groupDirty = g.fields.some((f) => dirtyKeys.includes(f.key))}
          <CmsButton variant="ghost"
            class={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full ${activeGroup === g.key ? 'bg-forest text-white shadow-sm' : 'text-ink/65 hover:bg-sand/60'}`}
            type="button"
            onclick={() => selectGroup(g.key)}
          >
            <span class={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${activeGroup === g.key ? 'bg-surface/15' : 'bg-sand/70'}`}><Icon size={15} /></span>
            <span class="whitespace-nowrap">{g.label}</span>
            {#if groupDirty}<span class="ml-auto hidden h-2 w-2 shrink-0 rounded-full bg-goldfinch-gold lg:block"></span>{/if}
          </CmsButton>
        {/each}
      </nav>

      <!-- form area -->
      <section class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm sm:p-6">
        <div class="flex items-center gap-3 border-b border-ink/10 pb-4">
          <svelte:component this={group.icon} size={20} class="text-forest" />
          <h2 class="text-lg font-bold text-ink">{group.label} settings</h2>
        </div>

        {#if group.note}
          <p class="flex items-start gap-2 rounded-xl border border-sky-200/70 bg-sky-50 p-3 text-xs leading-5 text-sky-800">
            <Info size={15} class="mt-0.5 shrink-0" />{group.note}
          </p>
        {/if}

        <div class="grid gap-4 sm:grid-cols-2">
          {#each group.fields as field (field.key)}
            <div class={field.type === 'textarea' || field.type === 'rich' || field.type === 'json' || field.type === 'currency-list' || field.type === 'image' ? 'sm:col-span-2' : ''}>
              {#if field.type === 'boolean'}
                <CmsLabel class="flex h-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-surface p-4 transition hover:bg-sand/30">
                  <span>
                    <span class="text-sm font-semibold text-ink">{field.label}</span>
                    {#if field.helper}<span class="mt-0.5 block text-xs text-ink/50">{field.helper}</span>{/if}
                  </span>
                  <CmsCheckbox class="h-5 w-5 accent-forest"  bind:checked={values[field.key]} />
                </CmsLabel>
              {:else if field.type === 'textarea'}
                <AdminTextArea label={field.label} name={field.key} bind:value={values[field.key]} rows={3} />
                {#if field.helper}<p class="mt-1 text-xs text-ink/50">{field.helper}</p>{/if}
              {:else if field.type === 'rich'}
                <!-- Keyed by field: switching between legal pages mounts a fresh
                     editor instead of carrying one page's history into another. -->
                {#key field.key}
                  <AdminRichText
                    label={field.label}
                    name={field.key}
                    bind:value={values[field.key]}
                    headings="h2h3"
                    rows={22}
                    hint="Use Heading 2 for each section and Heading 3 for sub-sections, as the page does now."
                  />
                {/key}
              {:else if field.type === 'json'}
                <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
                  <span>{field.label}</span>
                  <CmsTextarea class="min-h-[100px] rounded-2xl border border-ink/10 bg-surface px-3 py-2 font-mono text-xs shadow-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" bind:value={values[field.key]} spellcheck="false"></CmsTextarea>
                  {#if field.helper}<span class="text-xs font-normal text-ink/50">{field.helper}</span>{/if}
                </CmsLabel>
              {:else if field.type === 'currency-list'}
                <div class="grid gap-3">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-ink">{field.label}</p>
                      {#if field.helper}<p class="mt-1 text-xs leading-5 text-ink/50">{field.helper}</p>{/if}
                    </div>
                    <CmsButton variant="ghost" class="inline-flex h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-sm font-bold text-ink shadow-sm transition hover:bg-sand/60" type="button" onclick={addCurrency}>
                      <Plus size={15} /> Add currency
                    </CmsButton>
                  </div>

                  <div class="overflow-hidden rounded-xl border border-ink/10">
                    <div class="hidden grid-cols-[90px_minmax(170px,1fr)_100px_140px_96px_86px_48px] gap-2 border-b border-ink/10 bg-sand/35 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink/50 xl:grid">
                      <span>Code</span>
                      <span>Name</span>
                      <span>Symbol</span>
                      <span>Locale</span>
                      <span>Decimals</span>
                      <span>Enabled</span>
                      <span></span>
                    </div>
                    <div class="divide-y divide-ink/10">
                      {#each currencyRows as row, index}
                        <div class="grid gap-2 px-3 py-3 xl:grid-cols-[90px_minmax(170px,1fr)_100px_140px_96px_86px_48px] xl:items-center">
                          <CmsLabel class="grid gap-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/45 xl:block">
                            <span class="xl:hidden">Code</span>
                            <CmsInput class="h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm font-extrabold uppercase tracking-normal text-heading outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" value={row.code} maxlength={3} disabled={row.code === 'USD'} oninput={(event) => updateCurrencyRow(index, { code: (event.currentTarget as HTMLInputElement).value })} />
                          </CmsLabel>
                          <CmsLabel class="grid gap-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/45 xl:block">
                            <span class="xl:hidden">Name</span>
                            <CmsInput class="h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm font-medium tracking-normal text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" value={row.name} oninput={(event) => updateCurrencyRow(index, { name: (event.currentTarget as HTMLInputElement).value })} />
                          </CmsLabel>
                          <CmsLabel class="grid gap-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/45 xl:block">
                            <span class="xl:hidden">Symbol</span>
                            <CmsInput class="h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm font-medium tracking-normal text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" value={row.symbol} oninput={(event) => updateCurrencyRow(index, { symbol: (event.currentTarget as HTMLInputElement).value })} />
                          </CmsLabel>
                          <CmsLabel class="grid gap-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/45 xl:block">
                            <span class="xl:hidden">Locale</span>
                            <CmsInput class="h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm font-medium tracking-normal text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" value={row.locale} placeholder="en-US" oninput={(event) => updateCurrencyRow(index, { locale: (event.currentTarget as HTMLInputElement).value })} />
                          </CmsLabel>
                          <CmsLabel class="grid gap-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/45 xl:block">
                            <span class="xl:hidden">Decimals</span>
                            <CmsInput class="h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm font-medium tracking-normal text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" type="number" min="0" max="4" value={row.decimalDigits} disabled={row.code === 'USD'} oninput={(event) => updateCurrencyRow(index, { decimalDigits: Number((event.currentTarget as HTMLInputElement).value) })} />
                          </CmsLabel>
                          <CmsLabel class="flex h-10 items-center justify-between gap-3 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-bold uppercase tracking-[0.08em] text-ink/45 xl:justify-center xl:border-0 xl:bg-transparent xl:px-0">
                            <span class="xl:hidden">Enabled</span>
                            <CmsCheckbox class="h-5 w-5 accent-forest"  checked={row.enabled} disabled={row.code === 'USD'} onCheckedChange={(checked) => updateCurrencyRow(index, { enabled: checked })} />
                          </CmsLabel>
                          <CmsButton variant="ghost" class="grid h-10 w-full place-items-center rounded-xl border border-ink/10 bg-surface text-ink/55 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 xl:w-10" type="button" aria-label={`Remove ${row.code || 'currency'}`} disabled={row.code === 'USD'} onclick={() => removeCurrency(index)}>
                            <Trash2 size={15} />
                          </CmsButton>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {:else if field.type === 'select'}
                <AdminSelect label={field.label} name={field.key} bind:value={values[field.key]} options={field.key === 'default_currency' ? enabledCurrencyOptions : (field.options ?? []).map((o) => ({ label: o, value: o }))} />
              {:else if field.type === 'color'}
                <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
                  <span>{field.label}</span>
                  <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-2 shadow-sm">
                    <CmsInput class="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-ink/10 bg-surface p-0.5" type="color" bind:value={values[field.key]} aria-label={field.label} />
                    <CmsInput class="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase outline-none" bind:value={values[field.key]} spellcheck="false" />
                  </span>
                </CmsLabel>
              {:else if field.type === 'image'}
                <!--
                  The shared picker: Media Library, direct upload and paste-URL
                  in one control. This used to be a URL box beside a bespoke
                  browse-only modal, so the library was reachable but uploading
                  a new logo meant leaving for the Media page first.
                -->
                <div class="grid gap-2 text-sm font-medium text-ink">
                  <MediaPicker
                    label={field.label}
                    uploadFolder="settings"
                    aspect={field.aspect ?? 'aspect-[16/9]'}
                    fit={field.fit ?? 'object-cover'}
                    value={String(values[field.key] ?? '')}
                    on:change={(event) => (values[field.key] = event.detail)}
                  />
                  {#if field.helper}<span class="text-xs font-normal text-ink/50">{field.helper}</span>{/if}
                </div>
              {:else}
                <AdminFormInput label={field.label} name={field.key} type={field.type === 'phone' ? 'tel' : field.type} bind:value={values[field.key]} placeholder={field.helper ?? ''} />
              {/if}
            </div>
          {/each}
        </div>

        {#if group.legalDoc}
          {@const pageId = legalDefaults?.[group.legalDoc]?.id}
          {@const unsaved = group.fields.some((f) => dirtyKeys.includes(f.key))}
          <div class="mt-2 grid gap-3 border-t border-ink/10 pt-5">
            <div>
              <h3 class="flex items-center gap-2 text-base font-bold text-ink"><Languages size={17} class="text-forest" />Translations</h3>
              <p class="mt-1 text-xs leading-5 text-ink/55">
                Visitors reading the site in another language see this page in that language once its translation is published.
                Anything left untranslated shows in English.
              </p>
            </div>
            {#if unsaved}
              <p class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                <Info size={15} class="mt-0.5 shrink-0" />Save your changes first — translations are made from the saved English, not from unsaved edits.
              </p>
            {/if}
            {#if pageId}
              <!-- Re-mounted after a save, so the English beside each translation is the text just saved. -->
              {#key `${group.legalDoc}-${savedVersion}`}
                <AdminTranslationTabs
                  bind:unsaved={legalTranslationUnsaved}
                  stickyOffset="88px"
                  entityType="legal_pages"
                  entityId={pageId}
                  on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')}
                />
              {/key}
            {:else}
              <p class="text-sm text-ink/60">Couldn't load this page's translations. Reload to try again.</p>
            {/if}
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>

<!-- sticky save bar -->
{#if !loading && !error}
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
    <div class="pointer-events-auto flex w-full max-w-[1500px] items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-surface/95 px-5 py-3 shadow-[0_-6px_30px_rgba(57,61,50,0.12)] backdrop-blur">
      <p class="text-sm font-medium text-ink/60">
        {#if hasChanges}<span class="font-bold text-goldfinch-gold">{dirtyKeys.length}</span> unsaved change{dirtyKeys.length === 1 ? '' : 's'}{:else}All changes saved{/if}
      </p>
      <div class="flex gap-2">
        <AdminButton variant="secondary" type="button" disabled={!hasChanges || saving} on:click={discard}><RotateCcw size={15} />Discard</AdminButton>
        <AdminButton type="button" disabled={!hasChanges || saving} on:click={save}><Save size={16} />{saving ? 'Saving...' : 'Save Changes'}</AdminButton>
      </div>
    </div>
  </div>
{/if}

