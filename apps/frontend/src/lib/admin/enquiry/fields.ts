/**
 * The shared field library.
 *
 * Every question that appears on more than one form is defined once here, so
 * "adults" behaves and validates identically whether it is asked on the
 * homepage, a category page or a tour page. Form configs compose these; only
 * genuinely context-specific questions are written inline.
 */
import type { Field, FormValues, Option } from './types';

const opts = (...labels: string[]): Option[] => labels.map((label) => ({ label, value: label }));

export const NOT_SURE = 'Not sure yet';

// ── shared option sets ───────────────────────────────────────────────────────
export const DURATIONS = opts('1–3 days', '4–6 days', '7–10 days', '11–14 days', '15+ days', NOT_SURE);
export const TIMING = opts('Exact date', 'Approximate month', 'Flexible', NOT_SURE);
export const ACCOMMODATION = opts('Value', 'Mid-range', 'Luxury', NOT_SURE);
export const YES_NO = opts('Yes', 'No', NOT_SURE);
export const CONTACT_METHODS = opts('Email', 'WhatsApp', 'Phone call');
export const LANGUAGES = opts('English', 'French', 'German', 'Italian', 'Spanish', 'Portuguese', 'Other');
export const FLEXIBILITY = opts('Exact dates', '± a few days', '± a couple of weeks', 'Fully flexible');

/**
 * Budget bands are authored in USD because that is how the team quotes. The
 * label a visitor sees is converted to their selected currency at render time;
 * the stored answer keeps the USD band so enquiries stay comparable.
 */
export const BUDGET_BANDS_USD: { label: string; value: string; from: number; to?: number }[] = [
  { label: 'Under $2,000', value: 'under_2000', from: 0, to: 2000 },
  { label: '$2,000–$3,500', value: '2000_3500', from: 2000, to: 3500 },
  { label: '$3,500–$5,000', value: '3500_5000', from: 3500, to: 5000 },
  { label: '$5,000–$8,000', value: '5000_8000', from: 5000, to: 8000 },
  { label: '$8,000+', value: '8000_plus', from: 8000 },
  { label: NOT_SURE, value: 'not_sure', from: 0 }
];

// ── validators ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const requireText = (message: string) => (value: FormValues[string]) =>
  String(value ?? '').trim() ? '' : message;

// ── traveller counts ─────────────────────────────────────────────────────────
export const adultsField: Field = {
  key: 'adults',
  label: 'Adults',
  kind: 'number',
  min: 1,
  max: 20,
  half: true,
  required: true,
  validate: (value) => (Number(value ?? 0) >= 1 ? '' : 'At least one adult is needed')
};

export const childrenField: Field = {
  key: 'children',
  label: 'Children',
  kind: 'number',
  min: 0,
  max: 12,
  half: true
};

/** Only asked once there is a child to ask about. */
export const childAgesField: Field = {
  key: 'child_ages',
  label: "Children's ages",
  hint: 'Ages at the time of travel.',
  kind: 'child-ages',
  showIf: (values) => Number(values.children ?? 0) > 0,
  validate: (value, values) => {
    const wanted = Number(values.children ?? 0);
    if (wanted < 1) return '';
    const ages = Array.isArray(value) ? (value as number[]) : [];
    const given = ages.filter((age) => age !== undefined && age !== null && String(age) !== '').length;
    return given >= wanted ? '' : 'Please give an age for each child';
  }
};

// ── dates ────────────────────────────────────────────────────────────────────
export const timingField: Field = {
  key: 'travel_timing',
  label: 'When would you like to travel?',
  kind: 'chips',
  options: TIMING,
  required: true
};

export const exactDateField: Field = {
  key: 'travel_date',
  label: 'Preferred travel date',
  kind: 'date',
  half: true,
  showIf: (values) => values.travel_timing === 'Exact date',
  required: true
};

export const monthField: Field = {
  key: 'travel_month',
  label: 'Approximate month',
  kind: 'month',
  half: true,
  showIf: (values) => values.travel_timing === 'Approximate month',
  required: true
};

export const flexibilityField: Field = {
  key: 'date_flexibility',
  label: 'How flexible are those dates?',
  kind: 'chips',
  options: FLEXIBILITY,
  half: true
};

export const durationField: Field = {
  key: 'trip_duration',
  label: 'Trip duration',
  kind: 'chips',
  options: DURATIONS,
  required: true
};

// ── preferences ──────────────────────────────────────────────────────────────
export const accommodationField: Field = {
  key: 'accommodation_style',
  label: 'Preferred accommodation style',
  kind: 'chips',
  options: ACCOMMODATION,
  required: true
};

export const budgetField: Field = {
  key: 'budget_range',
  label: 'Approximate budget per person',
  hint: 'Optional — helps us recommend honestly.',
  kind: 'chips',
  options: BUDGET_BANDS_USD.map((band) => ({ label: band.label, value: band.value }))
};

export const specialRequestsField: Field = {
  key: 'special_requests',
  label: 'Anything else we should know?',
  hint: 'Optional — dietary, mobility, celebrations.',
  kind: 'textarea',
  placeholder: 'Tell us anything that would shape the trip…'
};

// ── about you ────────────────────────────────────────────────────────────────
export const nameField: Field = {
  key: 'full_name',
  label: 'Full name',
  kind: 'text',
  required: true,
  half: true,
  placeholder: 'Your name',
  validate: (value) => (String(value ?? '').trim().length >= 2 ? '' : 'Please enter your name')
};

export const emailField: Field = {
  key: 'email',
  label: 'Email',
  kind: 'email',
  required: true,
  half: true,
  placeholder: 'you@example.com',
  validate: (value) => (EMAIL_RE.test(String(value ?? '').trim()) ? '' : 'Please enter a valid email address')
};

export const phoneField: Field = {
  key: 'phone',
  label: 'Phone / WhatsApp (optional)',
  kind: 'tel',
  half: true,
  placeholder: '+255 …',
  validate: (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return raw.replace(/[^0-9]/g, '').length >= 6 ? '' : 'Please enter a valid phone number';
  }
};

export const countryField: Field = {
  key: 'country',
  label: 'Country of residence',
  kind: 'country',
  half: true,
  required: true,
  validate: requireText('Please choose your country')
};

export const languageField: Field = {
  key: 'preferred_language',
  label: 'Preferred language',
  kind: 'select',
  options: LANGUAGES,
  half: true
};

export const contactMethodField: Field = {
  key: 'preferred_contact_method',
  label: 'How should we reply?',
  kind: 'chips',
  options: CONTACT_METHODS,
  // Pairs with "Preferred language" on one row.
  half: true,
  required: true
};

export const bestTimeField: Field = {
  key: 'best_time_to_contact',
  label: 'Best time to contact (optional)',
  kind: 'text',
  half: true,
  placeholder: 'e.g. mornings, after 6pm my time'
};

/**
 * Transactional WhatsApp consent — permission to message this traveller about
 * their own trip. Separate from marketing below, and unticked by default:
 * giving us a phone number is not the same as asking to be messaged on it.
 */
export const whatsappConsentField: Field = {
  key: 'whatsapp_opt_in',
  label: 'Contact me on WhatsApp about my trip, quotation and booking updates',
  hint: 'Optional. We will still reply by email either way.',
  kind: 'checkbox'
};

export const marketingConsentField: Field = {
  key: 'marketing_consent',
  label: 'Send me occasional travel ideas and offers',
  hint: 'Separate from your enquiry — we reply either way.',
  kind: 'checkbox'
};

/** The contact block every form ends with. */
export const aboutYouFields = (): Field[] => [
  nameField,
  emailField,
  phoneField,
  countryField,
  languageField,
  contactMethodField,
  bestTimeField,
  whatsappConsentField,
  marketingConsentField
];

/** Traveller counts + conditional ages, shared by all three forms. */
export const travellerFields = (): Field[] => [adultsField, childrenField, childAgesField];
