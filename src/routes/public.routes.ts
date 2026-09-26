import { Router } from 'express';
import { getPublicSettings } from '../controllers/settings.controller';
import { getLegalPage } from '../controllers/legal.controller';
import { resolveImageVariants } from '../controllers/media.controller';

const router = Router();

// Public, unauthenticated configuration for the website (only is_public settings).
router.get('/settings', getPublicSettings);

// One legal page (privacy, terms, cancellation, data_retention), ?locale= aware.
router.get('/legal/:doc', getLegalPage);

// Public batch resolver for responsive image metadata (see controller).
router.get('/image-variants', resolveImageVariants);

export default router;
