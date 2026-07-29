import { Router } from 'express';
import {
  createReview,
  deleteReview,
  getReview,
  listReviews,
  reviewSummary,
  updateReview
} from '../controllers/reviews.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { reviewCreateSchema, reviewUpdateSchema } from '../schemas/reviews.schema';

const router = Router();

router.get('/', listReviews);
router.get('/summary', reviewSummary);
router.get('/:id', getReview);
router.post('/', authenticate, requirePermission('reviews.create'), validate({ body: reviewCreateSchema }), createReview);
router.put('/:id', authenticate, requirePermission('reviews.update'), validate({ body: reviewUpdateSchema }), updateReview);
router.delete('/:id', authenticate, requirePermission('reviews.delete'), deleteReview);

export default router;
