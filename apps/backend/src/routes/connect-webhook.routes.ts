import { Router } from 'express';
import { receiveConnectWebhook } from '../controllers/connect-webhook.controller';

const router = Router();

/**
 * Payment events from Makutano Connect.
 *
 * No authenticate middleware by design — Connect is a server, not a logged-in
 * user. The HMAC signature over the raw body IS the credential, checked first
 * thing in the controller, and the endpoint refuses everything when no signing
 * secret is configured.
 */
router.post('/connect', receiveConnectWebhook);

export default router;
