import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import {
  aiTranslate,
  copyFromDefault,
  listEntityTranslations,
  listLanguages,
  updateLanguage,
  upsertTranslation
} from '../controllers/translations.controller';

const router = Router();

// Languages: public read (enabled only; ?all=1 with auth returns everything),
// settings-level permission to manage.
router.get('/languages', optionalAuthenticate, listLanguages);
router.patch('/languages/:code', authenticate, requirePermission('settings.update'), updateLanguage);

// Entity translations. Per-entity permission (tours.update etc.) is resolved
// inside the controller because the routes are generic.
router.get('/:entityType/:entityId', authenticate, listEntityTranslations);
router.put('/:entityType/:entityId/:code', authenticate, upsertTranslation);
router.post('/:entityType/:entityId/:code/copy-from-default', authenticate, copyFromDefault);
router.post('/:entityType/:entityId/:code/ai', authenticate, aiTranslate);

export default router;
