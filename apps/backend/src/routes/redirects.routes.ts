import { Router } from 'express';
import {
  createRedirect,
  deleteRedirect,
  getRedirect,
  listRedirects,
  resolveRedirect,
  updateRedirect
} from '../controllers/redirects.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { redirectCreateSchema, redirectUpdateSchema } from '../schemas/redirects.schema';

const router = Router();

router.get('/resolve', resolveRedirect);
router.get('/', authenticate, requirePermission('redirects.view'), listRedirects);
router.get('/:id', authenticate, requirePermission('redirects.view'), getRedirect);
router.post('/', authenticate, requirePermission('redirects.create'), validate({ body: redirectCreateSchema }), createRedirect);
router.put('/:id', authenticate, requirePermission('redirects.update'), validate({ body: redirectUpdateSchema }), updateRedirect);
router.delete('/:id', authenticate, requirePermission('redirects.delete'), deleteRedirect);

export default router;
