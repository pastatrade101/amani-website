import { Router } from 'express';
import {
  getAnalyticsFunnel,
  getAnalyticsLeads,
  getAnalyticsOverview,
  getAnalyticsSessions,
  getAnalyticsTimeseries,
  getAnalyticsTraffic,
  getIntegrations,
  trackEvent,
  trackSession
} from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { analyticsEventLimiter } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import { trackEventSchema, trackSessionSchema } from '../schemas/analytics.schema';

const router = Router();

// Public, PII-free event ingestion (rate-limited, allowlisted event names).
router.post('/events', analyticsEventLimiter, validate({ body: trackEventSchema }), trackEvent);

// Public, PII-free session attribution beacon (same rate limiter).
router.post('/sessions', analyticsEventLimiter, validate({ body: trackSessionSchema }), trackSession);

// Admin reads — reuse the dashboard permission.
router.get('/overview', authenticate, requirePermission('dashboard.view'), getAnalyticsOverview);
router.get('/leads', authenticate, requirePermission('dashboard.view'), getAnalyticsLeads);
router.get('/funnel', authenticate, requirePermission('dashboard.view'), getAnalyticsFunnel);
router.get('/timeseries', authenticate, requirePermission('dashboard.view'), getAnalyticsTimeseries);
router.get('/traffic', authenticate, requirePermission('dashboard.view'), getAnalyticsTraffic);
router.get('/sessions', authenticate, requirePermission('dashboard.view'), getAnalyticsSessions);
router.get('/integrations', authenticate, requirePermission('dashboard.view'), getIntegrations);

export default router;
