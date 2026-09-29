import { Router } from 'express';
import {
  createPricingOption,
  deletePricingOption,
  getPricingOption,
  listPricingOptions,
  listTourPricingSeasons,
  saveTourPricingSeasons,
  updatePricingOption
} from '../controllers/pricing-options.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { pricingOptionCreateSchema, pricingOptionUpdateSchema, pricingSeasonSaveSchema } from '../schemas/pricing-options.schema';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('tours.view'), listPricingOptions);
router.get('/seasons/:tourId', requirePermission('tours.view'), listTourPricingSeasons);
router.put('/seasons/:tourId', requirePermission('tours.update'), validate({ body: pricingSeasonSaveSchema }), saveTourPricingSeasons);
router.get('/:id', requirePermission('tours.view'), getPricingOption);
router.post('/', requirePermission('tours.create'), validate({ body: pricingOptionCreateSchema }), createPricingOption);
router.put('/:id', requirePermission('tours.update'), validate({ body: pricingOptionUpdateSchema }), updatePricingOption);
router.delete('/:id', requirePermission('tours.delete'), deletePricingOption);

export default router;
