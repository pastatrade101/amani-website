import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import {
  addConversationNote,
  getConversation,
  listAgents,
  listConversations,
  listTemplates,
  markConversationRead,
  receiveWebhook,
  sendMessage,
  updateConversationState,
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

// Inbox actions. Reading a thread needs view; anything that changes it — a
// reply, an assignment, a note, resolving — needs the handoff permission,
// which is the existing right to take a conversation over from the assistant.
router.get('/agents', authenticate, requirePermission('ai_conversations.view'), listAgents);
router.get('/templates', authenticate, requirePermission('ai_conversations.view'), listTemplates);
router.post('/conversations/:id/read', authenticate, requirePermission('ai_conversations.view'), markConversationRead);
router.patch('/conversations/:id', authenticate, requirePermission('ai_conversations.handoff'), updateConversationState);
router.post('/conversations/:id/notes', authenticate, requirePermission('ai_conversations.handoff'), addConversationNote);

export default router;
