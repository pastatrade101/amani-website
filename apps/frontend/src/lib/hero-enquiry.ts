/**
 * The homepage hero form, in two steps: trip basics (start date, travellers,
 * accommodation style), then the traveller's details. The trip basics are
 * optional on the server so an older page or a no-JS submission still works.
 */
export const HERO_STYLES = [
 { id: 'budget', label: 'Budget' },
 { id: 'midrange', label: 'Midrange' },
 { id: 'luxury', label: 'Luxury' }
] as const;
export type HeroStyle = (typeof HERO_STYLES)[number]['id'];

export type HeroEnquiryValues = {
 full_name: string;
 email: string;
 details: string;
 travel_date?: string;
 adults?: string;
 children?: string;
 accommodation_style?: string;
};
export type HeroEnquiryErrors = Partial<Record<keyof HeroEnquiryValues, string>>;

const isoToday = () => new Date().toISOString().slice(0, 10);
const count = (value: string | undefined, min: number, max: number) => {
 if (!value?.trim()) return null;
 const n = Number(value);
 return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
};

/** Step one: when, how many, which style. `required` is the visitor-facing check; the server only checks what was sent. */
export function validateTripBasics(values: HeroEnquiryValues, required = false, today = isoToday()) {
 const errors: HeroEnquiryErrors = {};
 const date = values.travel_date?.trim() ?? '';
 if (date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.travel_date = 'Please choose a valid date.'; else if (date < today) errors.travel_date = 'Please choose a date from today onwards.'; }
 else if (required) errors.travel_date = 'Please choose your preferred start date.';
 const adults = count(values.adults, 1, 30);
 if (Number.isNaN(adults)) errors.adults = 'Adults must be between 1 and 30.';
 else if (adults === null && required) errors.adults = 'Please tell us how many adults are travelling.';
 if (Number.isNaN(count(values.children, 0, 30))) errors.children = 'Children must be between 0 and 30.';
 const style = values.accommodation_style?.trim() ?? '';
 if (style && !HERO_STYLES.some((item) => item.id === style)) errors.accommodation_style = 'Please choose an accommodation style.';
 else if (!style && required) errors.accommodation_style = 'Please choose an accommodation style.';
 return errors;
}

/** Step two, plus whatever trip basics were sent. */
export function validateHeroEnquiry(values: HeroEnquiryValues, today = isoToday()) {
 const errors: HeroEnquiryErrors = validateTripBasics(values, false, today);
 if (values.full_name.trim().length < 2 || values.full_name.trim().length > 100) errors.full_name = 'Please enter your full name (2–100 characters).';
 if (values.email.trim().length > 254 || !/^\S+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Please enter a valid email address.';
 if (values.details.length > 2000) errors.details = 'Please keep your details under 2,000 characters.';
 return errors;
}

export type HeroEnquiryResult = { formKind: 'hero'; success: boolean; message: string; values: HeroEnquiryValues | null; errors: HeroEnquiryErrors };
