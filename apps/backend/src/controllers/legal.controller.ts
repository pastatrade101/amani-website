import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { sanitizeRichText } from '../utils/rich-text';
import { attachAvailableLocales, localeOf, localizeRecords } from '../utils/translations';
import { isLegalDocument, LEGAL_DEFAULTS, LEGAL_DOCUMENTS, LEGAL_PAGE_IDS, loadLegalRecord } from '../data/legal-pages';

/**
 * Public, unauthenticated — one legal page, ready to render: the English with
 * any Settings edits, in the requested language where a translation of it is
 * published (per field; untranslated fields stay English).
 */
export const getLegalPage = asyncHandler(async (req, res) => {
  const doc = req.params.doc;
  if (!isLegalDocument(doc)) throw new AppError('Legal page not found.', 404);

  const record = await loadLegalRecord(doc);
  // The languages this page is published in, for hreflang and the switcher.
  await attachAvailableLocales('legal_pages', [record]);
  await localizeRecords('legal_pages', [record], localeOf(req.query.locale));
  // Translations are sanitised when saved; this keeps the page safe even if a
  // row was ever written by hand.
  record.body = sanitizeRichText(record.body);

  return sendSuccess(res, 'Legal page fetched successfully.', record);
});

/** The built-in wording and fixed id of every legal page, for the Settings form. */
export const getLegalDefaults = asyncHandler(async (_req, res) =>
  sendSuccess(
    res,
    'Legal page defaults fetched successfully.',
    Object.fromEntries(LEGAL_DOCUMENTS.map((doc) => [doc, { id: LEGAL_PAGE_IDS[doc], ...LEGAL_DEFAULTS[doc] }]))
  )
);
