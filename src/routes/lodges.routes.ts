import { Router } from 'express';
import {
  createLodge,
  deleteLodge,
  getLodge,
  listLodges,
  updateLodge, bulkDeleteLodges, bulkUpdateLodgeStatus } from '../controllers/lodges.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { lodgeCreateSchema, lodgeUpdateSchema } from '../schemas/lodges.schema';
import { getLodgeGallery, getLodgeMedia, listAmenities, replaceLodgeAmenities, replaceLodgeImages } from '../controllers/lodge-media.controller';
import { lodgeAmenitiesReplaceSchema, lodgeImagesReplaceSchema } from '../schemas/lodge-media.schema';
import { lodgeDetailsReplaceSchema } from '../schemas/lodge-details.schema';
import { getLodgeDetails, listAccommodationMeta, replaceLodgeDetails } from '../controllers/lodge-details.controller';

const router = Router();

router.get('/', listLodges);
// Registered before '/:slug' so these literal paths are not read as slugs.
router.post('/bulk-delete', authenticate, requirePermission('lodges.delete'), bulkDeleteLodges);
router.post('/bulk-status', authenticate, requirePermission('lodges.update'), bulkUpdateLodgeStatus);
// Literal paths before '/:slug' so they are not read as slugs.
router.get('/meta/amenities', authenticate, requirePermission('lodges.view'), listAmenities);
router.get('/meta/accommodation', authenticate, requirePermission('lodges.view'), listAccommodationMeta);
router.get('/:id/gallery', getLodgeGallery);
router.get('/:id/media', authenticate, requirePermission('lodges.view'), getLodgeMedia);
router.get('/:id/details', authenticate, requirePermission('lodges.view'), getLodgeDetails);
router.put('/:id/details', authenticate, requirePermission('lodges.update'), validate({body:lodgeDetailsReplaceSchema}), replaceLodgeDetails);
router.put('/:id/images', authenticate, requirePermission('lodges.update'), validate({ body: lodgeImagesReplaceSchema }), replaceLodgeImages);
router.put('/:id/amenities', authenticate, requirePermission('lodges.update'), validate({ body: lodgeAmenitiesReplaceSchema }), replaceLodgeAmenities);
router.get('/:slug', getLodge);
router.post('/', authenticate, requirePermission('lodges.create'), validate({ body: lodgeCreateSchema }), createLodge);
router.put('/:id', authenticate, requirePermission('lodges.update'), validate({ body: lodgeUpdateSchema }), updateLodge);
router.delete('/:id', authenticate, requirePermission('lodges.delete'), deleteLodge);

export default router;
