import { Router } from 'express';
import {
  deleteErrorLog,
  ingestError,
  listErrorLogs,
  updateErrorLog
} from '../controllers/error-logs.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { errorLogIngestSchema, errorLogUpdateSchema } from '../schemas/error-logs.schema';

const router = Router();

// Public: a frontend reports a broken URL / 404 (aggregated server-side).
router.post('/', validate({ body: errorLogIngestSchema }), ingestError);

// Admin: view + resolve aggregated error logs.
router.get('/', authenticate, requirePermission('error_logs.view'), listErrorLogs);
router.put('/:id', authenticate, requirePermission('error_logs.view'), validate({ body: errorLogUpdateSchema }), updateErrorLog);
router.delete('/:id', authenticate, requirePermission('error_logs.view'), deleteErrorLog);

export default router;
