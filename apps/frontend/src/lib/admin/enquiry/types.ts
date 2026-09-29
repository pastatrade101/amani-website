/**
 * Types for the configurable enquiry form system.
 *
 * The three contextual forms differ only in configuration: which steps exist,
 * which fields are on them, what the headings say, and what context is attached
 * to the submission. Nothing about a form type is expressed as a component.
 */

export const FORM_TYPES = ['homepage_trip_planner', 'category_enquiry', 'tour_enquiry'] as const;
export type FormType = (typeof FORM_TYPES)[number];

export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  /** Dial-code picker beside the number, as the trip request form uses. */
  | 'phone'
  | 'textarea'
  /** Hidden behind an "add" button until someone wants it. */
  | 'textarea-optional'
  | 'select'
  | 'chips'
  | 'chips-multi'
  /** Chips with a picture and a line of explanation — for a choice worth looking at. */
  | 'cards'
  /** Stepper, for counts of one or two taps. */
  | 'number'
  /** Plain box, for a number you would rather type than tap up to. */
  | 'number-plain'
  | 'date'
  | 'month'
  | 'country'
  | 'child-ages'
  | 'checkbox';

export type Option = {
  label: string;
  value: string;
  /** 'cards' only: the line under the title. */
  description?: string;
  /** 'cards' only. Absent is normal — the card then renders as text alone. */
  image?: string;
};

/** Every answer we hold. Child ages are the only array of numbers. */
export type FormValues = Record<string, string | string[] | number | number[] | boolean | undefined>;

export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  /** Shown under the label — for guidance, not as a replacement for it. */
  hint?: string;
  placeholder?: string;
  required?: boolean;
  options?: Option[];
  /** Half-width on desktop, full width on mobile. */
  half?: boolean;
  min?: number;
  max?: number;
  /** Render only when this returns true. Re-evaluated on every change. */
  showIf?: (values: FormValues) => boolean;
  /** Return a message to block the step, or '' to pass. */
  validate?: (value: FormValues[string], values: FormValues) => string;
};

export type Step = {
  key: string;
  /** Short label for the progress rail. */
  label: string;
  /** Heading inside the step body. Optional — the modal header carries the title. */
  heading?: string;
  blurb?: string;
  fields: Field[];
};

/** Context the form was opened with — becomes submission metadata. */
export type EnquiryContext = {
  category?: { id?: string; name?: string; slug?: string };
  tour?: {
    id?: string;
    title?: string;
    slug?: string;
    price_from?: number;
    currency?: string;
    duration_days?: number;
    image?: string;
    destinations?: string;
  };
};

export type FormConfig = {
  formType: FormType;
  title: string;
  description?: string;
  submitLabel: string;
  /** Reassurance under the submit button. */
  submitNote?: string;
  steps: Step[];
};
