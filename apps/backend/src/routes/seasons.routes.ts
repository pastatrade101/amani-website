import { Router } from 'express';
import { createSeason, deleteSeason, getSeason, listSeasons, updateSeason } from '../controllers/seasons.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { seasonCreateSchema, seasonUpdateSchema } from '../schemas/seasons.schema';

const router = Router();

// Seasons are homepage content, so they share the homepage permission rather
// than adding a new key every role would need granting.
router.get('/', listSeasons);
router.get('/:id', getSeason);
router.post('/', authenticate, requirePermission('homepage.update'), validate({ body: seasonCreateSchema }), createSeason);
router.put('/:id', authenticate, requirePermission('homepage.update'), validate({ body: seasonUpdateSchema }), updateSeason);
router.delete('/:id', authenticate, requirePermission('homepage.update'), deleteSeason);

export default router;
