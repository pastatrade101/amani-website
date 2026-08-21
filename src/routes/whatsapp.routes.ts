import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import {
  getConversation,
  listConversations,
  receiveWebhook,
  sendMessage,
  verifyWebhook,
  whatsappStatus
} from '../controllers/whatsapp.controller';

const router = Router();

/**
 * The webhook is public by necessity — Meta calls it — so its protection is
 * the HMAC signature check inside the handler, not authentication. The limiter
 * is a floor against a flood from a spoofed source; genuine Meta traffic for
 * one business number sits far below it.
 */
const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/webhook', verifyWebhook);
router.post('/webhook', webhookLimiter, receiveWebhook);

// Admin surface. Conversations are customer-support data, so they follow the
// existing AI conversation permissions rather than inventing a new scheme.
router.get('/status', authenticate, requirePermission('settings.view'), whatsappStatus);
router.get('/conversations', authenticate, requirePermission('ai_conversations.view'), listConversations);
router.get('/conversations/:id', authenticate, requirePermission('ai_conversations.view'), getConversation);
router.post('/send', authenticate, requirePermission('ai_conversations.handoff'), sendMessage);

export default router;
