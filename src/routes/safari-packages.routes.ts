import { Router } from 'express';
import {
  createSafariPackage,
  deleteSafariPackage,
  getSafariPackage,
  listSafariPackages,
  updateSafariPackage
} from '../controllers/safari-packages.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { safariPackageCreateSchema, safariPackageUpdateSchema } from '../schemas/safari-packages.schema';

const router = Router();

router.get('/', listSafariPackages);
router.get('/:slug', getSafariPackage);
router.post('/', authenticate, requirePermission('safari_packages.create'), validate({ body: safariPackageCreateSchema }), createSafariPackage);
router.put('/:id', authenticate, requirePermission('safari_packages.update'), validate({ body: safariPackageUpdateSchema }), updateSafariPackage);
router.delete('/:id', authenticate, requirePermission('safari_packages.delete'), deleteSafariPackage);

export default router;
