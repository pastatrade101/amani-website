import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isOriginAllowed } from './config/env';
import authRoutes from './routes/auth.routes';
import aiTravelAdvisorRoutes from './routes/ai-travel-advisor.routes';
import brandingRoutes from './routes/branding.routes';
import auditLogsRoutes from './routes/audit-logs.routes';
import analyticsRoutes from './routes/analytics.routes';
import availableDatesRoutes from './routes/available-dates.routes';
import blogRoutes from './routes/blog.routes';
import blogCategoriesRoutes from './routes/blog-categories.routes';
import bookingsRoutes from './routes/bookings.routes';
import currenciesRoutes from './routes/currencies.routes';
import tripPortalRoutes from './routes/trip-portal.routes';
import categoriesRoutes from './routes/categories.routes';
import translationsRoutes from './routes/translations.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import contactRoutes from './routes/contact.routes';
import lodgesRoutes from './routes/lodges.routes';
import activitiesRoutes from './routes/activities.routes';
import tripPointsRoutes from './routes/trip-points.routes';
import safetyTopicsRoutes from './routes/safety-topics.routes';
import travelStylesRoutes from './routes/travel-styles.routes';
import comparisonsRoutes from './routes/comparisons.routes';
import dashboardRoutes from './routes/dashboard.routes';
import departuresRoutes from './routes/departures.routes';
import destinationsRoutes from './routes/destinations.routes';
import faqsRoutes from './routes/faqs.routes';
import galleryRoutes from './routes/gallery.routes';
import homepageRoutes from './routes/homepage.routes';
import hubspotRoutes from './routes/hubspot.routes';
import itinerariesRoutes from './routes/itineraries.routes';
import mediaRoutes from './routes/media.routes';
import paymentsRoutes from './routes/payments.routes';
import permissionsRoutes from './routes/permissions.routes';
import pricingOptionsRoutes from './routes/pricing-options.routes';
import publicRoutes from './routes/public.routes';
import rolesRoutes from './routes/roles.routes';
import settingsRoutes from './routes/settings.routes';
import testimonialsRoutes from './routes/testimonials.routes';
import specialistsRoutes from './routes/specialists.routes';
import tourInclusionsRoutes from './routes/tour-inclusions.routes';
import tourExclusionsRoutes from './routes/tour-exclusions.routes';
import tourImagesRoutes from './routes/tour-images.routes';
import toursRoutes from './routes/tours.routes';
import itineraryImportRoutes from './routes/itinerary-import.routes';
import csvImportRoutes from './routes/csv-import.routes';
import uploadRoutes from './routes/upload.routes';
import usersRoutes from './routes/users.routes';
import reviewsRoutes from './routes/reviews.routes';
import migrationCalendarRoutes from './routes/migration-calendar.routes';
import redirectsRoutes from './routes/redirects.routes';
import errorLogsRoutes from './routes/error-logs.routes';
import pageSeoRoutes from './routes/page-seo.routes';
import exchangeRatesRoutes from './routes/exchange-rates.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import { sendSuccess } from './utils/api-response';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS.'));
    },
    credentials: true
  })
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS' || req.path === '/api/health'
  })
);
// Meta sends the webhook verify token as a query parameter, and morgan logs
// the full URL — which wrote a live credential into the access log on every
// subscription handshake. Redacted before the logger ever sees it.
morgan.token('url', (req) => {
  const url = (req as { originalUrl?: string; url?: string }).originalUrl ?? (req as { url?: string }).url ?? '';
  return url.replace(/([?&]hub\.verify_token=)[^&]*/i, '$1[redacted]');
});
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// The WhatsApp webhook signature is an HMAC over the EXACT bytes Meta sent, so
// the raw buffer is kept for that path only — parsing and re-serialising JSON
// changes key order and whitespace and would invalidate every signature.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      if (typeof req.url === 'string' && req.url.includes('/whatsapp/webhook')) {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      }
    }
  })
);
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  return sendSuccess(res, 'API is healthy.', {
    uptime: process.uptime(),
    environment: env.NODE_ENV
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiTravelAdvisorRoutes);
app.use('/api/tours', toursRoutes);
app.use('/api/itinerary-import', itineraryImportRoutes);
app.use('/api/import', csvImportRoutes);
app.use('/api/tour-inclusions', tourInclusionsRoutes);
app.use('/api/tour-exclusions', tourExclusionsRoutes);
app.use('/api/tour-images', tourImagesRoutes);
app.use('/api/itineraries', itinerariesRoutes);
app.use('/api/available-dates', availableDatesRoutes);
app.use('/api/pricing-options', pricingOptionsRoutes);
app.use('/api/categories', categoriesRoutes);
// Languages + per-entity content translations (multilingual CMS foundation).
app.use('/api/translations', translationsRoutes);
// WhatsApp Business Cloud API: Meta webhook + admin send/inbox.
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/lodges', lodgesRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/trip-points', tripPointsRoutes);
app.use('/api/safety-topics', safetyTopicsRoutes);
app.use('/api/travel-styles', travelStylesRoutes);
app.use('/api/comparisons', comparisonsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/currencies', currenciesRoutes);
app.use('/api/trip', tripPortalRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/blog-categories', blogCategoriesRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/specialists', specialistsRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/hubspot', hubspotRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/departures', departuresRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/migration-calendar', migrationCalendarRoutes);
app.use('/api/redirects', redirectsRoutes);
app.use('/api/errors', errorLogsRoutes);
app.use('/api/page-seo', pageSeoRoutes);
app.use('/api/internal/exchange-rates', exchangeRatesRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
