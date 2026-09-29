/**
 * The two things every quotation surface has to agree on.
 *
 * The status chip and the printed total were each written out three times —
 * once in the composer, once on the quotations list, once in the WhatsApp
 * inbox — and the three copies had already started to drift: the inbox printed
 * a raw `1250` where the list printed `USD 1,250.00` for the same row. One
 * definition each, so the same quotation reads the same wherever it appears.
 */

export type QuotationStatusMeta = { chip: string; label: string };

export const quotationStatusMeta: Record<string, QuotationStatusMeta> = {
  draft: { label: 'Draft', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  sent: { label: 'Sent', chip: 'bg-sky-50 text-sky-700 ring-sky-200/70' },
  viewed: { label: 'Viewed', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70' },
  // The two states where the work is ours, not the traveller's. Orange because
  // an agent scanning the list needs these to stand out from the ones that are
  // simply waiting on someone else — they are the queue.
  changes_requested: { label: 'Changes requested', chip: 'bg-orange-50 text-orange-700 ring-orange-200/70' },
  revised: { label: 'Revised · not sent', chip: 'bg-orange-50 text-orange-600 ring-orange-200/70' },
  accepted: { label: 'Accepted', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' },
  declined: { label: 'Declined', chip: 'bg-red-50 text-red-600 ring-red-200/70' },
  expired: { label: 'Expired', chip: 'bg-amber-50 text-amber-700 ring-amber-200/70' }
};

/**
 * Statuses in which the document is settled and must not be edited. Mirrors
 * isSettled() on the server — the server is the one that enforces it; this is
 * so the CMS does not offer an action it knows will be refused.
 */
export const quotationIsSettled = (quotation: { status?: unknown; frozen_at?: unknown }) =>
  ['accepted', 'declined'].includes(String(quotation.status ?? '')) || Boolean(quotation.frozen_at);

/** The fallback chip for a status the front end has not been taught yet. */
export const quotationStatusFallbackChip = 'bg-sand text-ink ring-ink/10';

export const quotationStatusLabel = (status: unknown) =>
  quotationStatusMeta[String(status)]?.label ?? String(status ?? '');

export const quotationStatusChip = (status: unknown) =>
  quotationStatusMeta[String(status)]?.chip ?? quotationStatusFallbackChip;

/**
 * The same string the traveller reads on their own quotation page.
 *
 * A quotation is priced in its own currency and nothing here converts it, so
 * the code is printed rather than a symbol that could be read as the wrong
 * money — the shared currency store exists to re-express USD prices for a
 * visitor, which is the opposite of what a quoted total needs.
 */
export const quotationMoney = (amount: unknown, currencyCode: unknown) =>
  `${String(currencyCode ?? 'USD')} ${Number(amount ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
