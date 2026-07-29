import { Router } from 'express';
import {
  createMigrationEntry,
  deleteMigrationEntry,
  getMigrationEntry,
  listMigrationCalendar,
  updateMigrationEntry
} from '../controllers/migration-calendar.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validate.middleware';
import { migrationCalendarCreateSchema, migrationCalendarUpdateSchema } from '../schemas/migration-calendar.schema';

const router = Router();

router.get('/', listMigrationCalendar);
router.get('/:id', getMigrationEntry);
router.post('/', authenticate, requirePermission('migration_calendar.create'), validate({ body: migrationCalendarCreateSchema }), createMigrationEntry);
router.put('/:id', authenticate, requirePermission('migration_calendar.update'), validate({ body: migrationCalendarUpdateSchema }), updateMigrationEntry);
router.delete('/:id', authenticate, requirePermission('migration_calendar.delete'), deleteMigrationEntry);

export default router;
