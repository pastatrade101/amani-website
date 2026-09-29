import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { quotationActionLimiter } from '../middleware/rate-limit.middleware';
import {
  acceptPublicQuotation,
  addQuotationComment,
  createQuotation,
  declinePublicQuotation,
  deleteQuotation,
  getPublicQuotation,
  getQuotation,
  getQuotationThread,
  listQuotations,
  requestChangesOnPublicQuotation,
  resolveQuotationComment,
  reviseQuotation,
  sendQuotation,
  setQuotationStatus,
  updateQuotation
} from '../controllers/quotations.controller';

const router = Router();

// The traveller's view. Token-only by design — they have a link, not an
// account — so this route is deliberately public and returns just the offer.
router.get('/public/:token', getPublicQuotation);

// Their answer to it. Rate limited: the token is the credential, so these are
// the only two routes where holding a link changes anything.
router.post('/public/:token/accept', quotationActionLimiter, acceptPublicQuotation);
router.post('/public/:token/decline', quotationActionLimiter, declinePublicQuotation);
// Asking for changes is neither yes nor no, and it is the one a traveller may
// legitimately send more than once. Same limiter — it writes to the same rows.
router.post('/public/:token/request-changes', quotationActionLimiter, requestChangesOnPublicQuotation);

// Admin. Quotations are commercial documents about a booking, so they follow
// the existing bookings permissions rather than inventing a parallel scheme.
router.get('/', authenticate, requirePermission('bookings.view'), listQuotations);
router.get('/:id', authenticate, requirePermission('bookings.view'), getQuotation);
router.post('/', authenticate, requirePermission('bookings.update'), createQuotation);
router.put('/:id', authenticate, requirePermission('bookings.update'), updateQuotation);
router.post('/:id/send', authenticate, requirePermission('bookings.update'), sendQuotation);
router.post('/:id/revise', authenticate, requirePermission('bookings.update'), reviseQuotation);
router.patch('/:id/status', authenticate, requirePermission('bookings.update'), setQuotationStatus);
router.delete('/:id', authenticate, requirePermission('bookings.delete'), deleteQuotation);

// The exchange about a quotation — the traveller's requests and the agent's
// own notes, plus every superseded version.
router.get('/:id/thread', authenticate, requirePermission('bookings.view'), getQuotationThread);
router.post('/:id/comments', authenticate, requirePermission('bookings.update'), addQuotationComment);
router.patch('/:id/comments/:commentId/resolve', authenticate, requirePermission('bookings.update'), resolveQuotationComment);

export default router;
