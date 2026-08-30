import { Router } from 'express';
import {
  assignBooking,
  createBooking,
  deleteBooking,
  getBooking,
  getBookingByCode,
  listBookings,
  updateBooking,
  updateBookingNotes,
  updateBookingStatus
} from '../controllers/bookings.controller';
import {
  createAmendment,
  deleteAmendment,
  listAmendments,
  updateAmendment
} from '../controllers/booking-amendments.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { formGuard } from '../middleware/form-guard.middleware';
import { publicFormBurstLimiter, publicFormLimiter } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  bookingAssignSchema,
  bookingCreateSchema,
  bookingNotesSchema,
  bookingStatusSchema,
  bookingUpdateSchema
} from '../schemas/bookings.schema';

const router = Router();

// Public booking submission (website booking form + plan my trip). Rate limited.
// optionalAuthenticate lets admin-created bookings be audited without blocking the public.
router.post('/', optionalAuthenticate, publicFormBurstLimiter, publicFormLimiter, formGuard, validate({ body: bookingCreateSchema }), createBooking);

router.get('/', authenticate, requirePermission('bookings.view'), listBookings);
router.get('/code/:bookingCode', authenticate, requirePermission('bookings.view'), getBookingByCode);
router.get('/:id', authenticate, requirePermission('bookings.view'), getBooking);
router.put('/:id/status', authenticate, requirePermission('bookings.update'), validate({ body: bookingStatusSchema }), updateBookingStatus);
router.put('/:id/assign', authenticate, requirePermission('bookings.assign'), validate({ body: bookingAssignSchema }), assignBooking);
router.put('/:id/notes', authenticate, requirePermission('bookings.update'), validate({ body: bookingNotesSchema }), updateBookingNotes);
router.put('/:id', authenticate, requirePermission('bookings.update'), validate({ body: bookingUpdateSchema }), updateBooking);
router.delete('/:id', authenticate, requirePermission('bookings.delete'), deleteBooking);

// Changes agreed after the quotation was accepted and frozen. They hang off
// the booking rather than the quotation: the quotation is the record of what
// was agreed and stops changing, while the booking is the live trip.
router.get('/:id/amendments', authenticate, requirePermission('bookings.view'), listAmendments);
router.post('/:id/amendments', authenticate, requirePermission('bookings.update'), createAmendment);
router.patch('/:id/amendments/:amendmentId', authenticate, requirePermission('bookings.update'), updateAmendment);
router.delete('/:id/amendments/:amendmentId', authenticate, requirePermission('bookings.delete'), deleteAmendment);

export default router;
