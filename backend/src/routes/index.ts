import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as authController from '../controllers/auth.controller';
import * as leadsController from '../controllers/leads.controller';
import * as campaignController from '../controllers/campaign.controller';
import * as templatesController from '../controllers/templates.controller';
import * as signaturesController from '../controllers/signatures.controller';
import * as gmailController from '../controllers/gmail.controller';

const router = Router();

// ── Auth routes ──
router.post('/auth/setup', authController.setup);
router.post('/auth/login', authController.login);
router.get('/auth/check-setup', authController.checkSetup);
router.get('/auth/me', authMiddleware, authController.me);
router.put('/auth/password', authMiddleware, authController.changePassword);

// ── Leads routes ──
router.get('/leads', authMiddleware, leadsController.getLeads);
router.get('/leads/stats', authMiddleware, leadsController.getLeadStats);
router.get('/leads/:id', authMiddleware, leadsController.getLead);
router.post('/leads', authMiddleware, leadsController.createLead);
router.post('/leads/bulk', authMiddleware, leadsController.bulkImportLeads);
router.put('/leads/:id', authMiddleware, leadsController.updateLead);
router.delete('/leads/:id', authMiddleware, leadsController.deleteLead);

// ── Campaign routes ──
router.post('/campaigns/start/:leadId', authMiddleware, campaignController.startCampaign);
router.post('/campaigns/send-next/:leadId', authMiddleware, campaignController.sendNextFollowup);
router.post('/campaigns/sync-replies/:leadId', authMiddleware, campaignController.syncReplies);
router.post('/campaigns/mark-converted/:leadId', authMiddleware, campaignController.markConverted);
router.post('/campaigns/bulk-start', authMiddleware, campaignController.bulkStartCampaigns);
router.get('/campaigns/status/:leadId', authMiddleware, campaignController.getCampaignStatus);
// Vercel Cron hits this via GET. Custom auth inside controller.
router.get('/campaigns/trigger-scheduler', campaignController.triggerScheduler as any);

// ── Template routes ──
router.get('/templates', authMiddleware, templatesController.getTemplates);
router.get('/templates/:id', authMiddleware, templatesController.getTemplate);
router.post('/templates', authMiddleware, templatesController.createTemplate);
router.put('/templates/:id', authMiddleware, templatesController.updateTemplate);
router.delete('/templates/:id', authMiddleware, templatesController.deleteTemplate);

// ── Signature routes ──
router.get('/signatures', authMiddleware, signaturesController.getSignatures);
router.post('/signatures', authMiddleware, signaturesController.createSignature);
router.put('/signatures/:id', authMiddleware, signaturesController.updateSignature);
router.delete('/signatures/:id', authMiddleware, signaturesController.deleteSignature);

// ── Gmail routes ──
router.get('/gmail/auth-url', authMiddleware, gmailController.getGmailAuthUrl);
router.get('/gmail/callback', gmailController.gmailCallback); // No auth — OAuth redirect
router.get('/gmail/status', authMiddleware, gmailController.getGmailStatus);

export default router;
