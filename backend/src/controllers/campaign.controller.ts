import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { sendEmail, fetchThreadReplies, getSmtpMessageId } from '../services/gmailService';
import { renderTemplate } from '../services/emailTemplates';
import { runScheduledFollowups } from '../services/campaignScheduler';

/**
 * Get the default template and signature for sending emails
 */
async function getDefaultsForSending(templateId?: string) {
  let template;
  if (templateId) {
    template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
  }
  if (!template) {
    template = await prisma.emailTemplate.findFirst({
      where: { isDefault: true },
    });
  }

  if (!template) {
    throw new Error('No default email template found. Create one first.');
  }

  const signature = await prisma.signature.findFirst({
    where: { isDefault: true },
  });

  if (!signature) {
    throw new Error('No default signature found. Create one first.');
  }

  return { template, signature };
}

/**
 * Calculate the next follow-up due date
 */
function getNextFollowupDate(): Date {
  const intervalDays = parseInt(process.env.FOLLOWUP_INTERVAL_DAYS || '3');
  const next = new Date();
  next.setDate(next.getDate() + intervalDays);
  next.setHours(9, 0, 0, 0); // Set to 9 AM
  return next;
}

/**
 * POST /api/campaigns/start/:leadId — Start campaign for a lead
 * Sends intro email, creates EmailCampaign, logs EmailReply
 */
export async function startCampaign(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { leadId } = req.params;
    const { templateId } = req.body || {};

    // Check if campaign already exists
    const existingCampaign = await prisma.emailCampaign.findUnique({
      where: { leadId },
    });

    if (existingCampaign) {
      res.status(400).json({ error: 'Campaign already exists for this lead' });
      return;
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const { template, signature } = await getDefaultsForSending(templateId);

    // Render the intro email
    const { subject, htmlBody } = renderTemplate(1, template, {
      company: lead.company,
      contactPerson: lead.contactPerson,
      serviceNeed: lead.serviceNeed || 'your project needs',
      country: lead.country || '',
    }, signature);

    // Send via Gmail
    const { threadId, messageId, smtpMessageId } = await sendEmail(
      lead.email,
      subject,
      htmlBody,
      signature.name
    );

    // Create campaign record
    const campaign = await prisma.emailCampaign.create({
      data: {
        leadId,
        status: 'active',
        currentStep: 1,
        introEmailSentAt: new Date(),
        nextFollowupDue: getNextFollowupDate(),
        gmailThreadId: threadId,
        gmailMessageId: smtpMessageId,
        templateId: template.id,
      },
    });

    // Log the sent email
    await prisma.emailReply.create({
      data: {
        leadId,
        gmailMessageId: messageId,
        direction: 'sent',
        fromEmail: 'me',
        fromName: signature.name,
        subject,
        body: htmlBody,
        bodyHtml: htmlBody,
        receivedAt: new Date(),
      },
    });

    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'intro_sent' },
    });

    res.status(201).json({ campaign, message: 'Intro email sent successfully' });
  } catch (error) {
    console.error('Start campaign error:', error);
    res.status(500).json({
      error: `Failed to start campaign: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Execute the next send step for a lead's campaign
 * Used by both manual trigger and the scheduler
 */
export async function executeSendStep(leadId: string): Promise<void> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { leadId },
    include: { lead: true },
  });

  if (!campaign) {
    throw new Error('No campaign found for this lead');
  }

  if (campaign.status !== 'active') {
    throw new Error(`Campaign is not active (status: ${campaign.status})`);
  }

  if (campaign.currentStep >= 4) {
    // Campaign complete — all 4 steps sent
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'completed', nextFollowupDue: null },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'unresponsive' },
    });

    throw new Error('Campaign already completed (all follow-ups sent)');
  }

  const nextStep = campaign.currentStep + 1;
  const { template, signature } = await getDefaultsForSending(campaign.templateId || undefined);

  // Render the follow-up email
  const { subject, htmlBody } = renderTemplate(nextStep, template, {
    company: campaign.lead.company,
    contactPerson: campaign.lead.contactPerson,
    serviceNeed: campaign.lead.serviceNeed || 'your project needs',
    country: campaign.lead.country || '',
  }, signature);

  // Send as threaded reply
  const { threadId, messageId, smtpMessageId } = await sendEmail(
    campaign.lead.email,
    subject,
    htmlBody,
    signature.name,
    campaign.gmailThreadId || undefined,
    campaign.gmailMessageId || undefined,
    campaign.gmailMessageId || undefined
  );

  // Determine which timestamp field to update
  const stepDateField =
    nextStep === 2 ? 'followup1SentAt' :
    nextStep === 3 ? 'followup2SentAt' :
    'followup3SentAt';

  // Update the status map for lead
  const leadStatusMap: Record<number, string> = {
    2: 'followup1_sent',
    3: 'followup2_sent',
    4: 'followup3_sent',
  };

  // Update campaign
  const updateData: any = {
    currentStep: nextStep,
    [stepDateField]: new Date(),
    gmailMessageId: smtpMessageId,
  };

  if (nextStep >= 4) {
    // Last follow-up sent — campaign completes
    updateData.status = 'completed';
    updateData.nextFollowupDue = null;
  } else {
    updateData.nextFollowupDue = getNextFollowupDate();
  }

  // Keep the threadId (should stay the same)
  if (threadId) {
    updateData.gmailThreadId = threadId;
  }

  await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: updateData,
  });

  // Log the sent email
  await prisma.emailReply.create({
    data: {
      leadId,
      gmailMessageId: messageId,
      direction: 'sent',
      fromEmail: 'me',
      fromName: signature.name,
      subject,
      body: htmlBody,
      bodyHtml: htmlBody,
      receivedAt: new Date(),
    },
  });

  // Update lead status
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: leadStatusMap[nextStep] || 'followup3_sent' },
  });
}

/**
 * POST /api/campaigns/send-next/:leadId — Manually trigger next follow-up
 */
export async function sendNextFollowup(req: AuthRequest, res: Response): Promise<void> {
  try {
    await executeSendStep(req.params.leadId);
    res.json({ message: 'Follow-up sent successfully' });
  } catch (error) {
    console.error('Send next error:', error);
    res.status(500).json({
      error: `Failed to send follow-up: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Sync replies for a lead — used by both the API endpoint and the scheduler
 */
export async function syncRepliesForLead(leadId: string): Promise<{
  newReplies: number;
  responseDetected: boolean;
}> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { leadId },
  });

  if (!campaign || !campaign.gmailThreadId) {
    return { newReplies: 0, responseDetected: false };
  }

  // Fetch all messages in the thread
  const messages = await fetchThreadReplies(campaign.gmailThreadId);

  let newReplies = 0;
  let responseDetected = false;

  for (const message of messages) {
    // Skip our own sent messages
    if (message.isSent) continue;

    // Check if we already have this message
    const existing = await prisma.emailReply.findFirst({
      where: {
        leadId,
        gmailMessageId: message.gmailMessageId,
      },
    });

    if (!existing) {
      // New reply found!
      await prisma.emailReply.create({
        data: {
          leadId,
          gmailMessageId: message.gmailMessageId,
          direction: 'received',
          fromEmail: message.fromEmail,
          fromName: message.fromName,
          subject: message.subject,
          body: message.body,
          bodyHtml: message.bodyHtml,
          receivedAt: message.receivedAt,
        },
      });

      newReplies++;
      responseDetected = true;
    }
  }

  // If a genuine reply was detected, update campaign and lead status
  if (responseDetected && campaign.status === 'active') {
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: 'responded',
        responseReceivedAt: new Date(),
        nextFollowupDue: null, // Stop the drip
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'responded' },
    });
  }

  return { newReplies, responseDetected };
}

/**
 * POST /api/campaigns/sync-replies/:leadId — Poll Gmail for new replies
 */
export async function syncReplies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await syncRepliesForLead(req.params.leadId);
    res.json(result);
  } catch (error) {
    console.error('Sync replies error:', error);
    res.status(500).json({
      error: `Failed to sync replies: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * POST /api/campaigns/mark-converted/:leadId — Mark lead as converted
 */
export async function markConverted(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { leadId } = req.params;

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'converted' },
    });

    const campaign = await prisma.emailCampaign.findUnique({
      where: { leadId },
    });

    if (campaign) {
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'completed',
          nextFollowupDue: null,
        },
      });
    }

    res.json({ message: 'Lead marked as converted' });
  } catch (error) {
    console.error('Mark converted error:', error);
    res.status(500).json({ error: 'Failed to mark lead as converted' });
  }
}

/**
 * POST /api/campaigns/bulk-start — Start campaigns for multiple leads
 */
export async function bulkStartCampaigns(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { leadIds, templateId } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ error: 'leadIds array is required' });
      return;
    }

    const results = { started: 0, failed: 0, errors: [] as string[] };

    for (const leadId of leadIds) {
      try {
        // Check if campaign already exists
        const existing = await prisma.emailCampaign.findUnique({
          where: { leadId },
        });

        if (existing) {
          results.errors.push(`Campaign already exists for lead ${leadId}`);
          results.failed++;
          continue;
        }

        // Use a simplified version — reuse the start logic
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
          results.errors.push(`Lead ${leadId} not found`);
          results.failed++;
          continue;
        }

        const { template, signature } = await getDefaultsForSending(templateId);

        const { subject, htmlBody } = renderTemplate(1, template, {
          company: lead.company,
          contactPerson: lead.contactPerson,
          serviceNeed: lead.serviceNeed || 'your project needs',
          country: lead.country || '',
        }, signature);

        const { threadId, messageId, smtpMessageId } = await sendEmail(
          lead.email,
          subject,
          htmlBody,
          signature.name
        );

        await prisma.emailCampaign.create({
          data: {
            leadId,
            status: 'active',
            currentStep: 1,
            introEmailSentAt: new Date(),
            nextFollowupDue: getNextFollowupDate(),
            gmailThreadId: threadId,
            gmailMessageId: smtpMessageId,
            templateId: template.id,
          },
        });

        await prisma.emailReply.create({
          data: {
            leadId,
            gmailMessageId: messageId,
            direction: 'sent',
            fromEmail: 'me',
            fromName: signature.name,
            subject,
            body: htmlBody,
            bodyHtml: htmlBody,
            receivedAt: new Date(),
          },
        });

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: 'intro_sent' },
        });

        results.started++;

        // Rate limit: 2-second delay between sends
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Lead ${leadId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Bulk start error:', error);
    res.status(500).json({ error: 'Failed to bulk start campaigns' });
  }
}

/**
 * GET /api/campaigns/status/:leadId — Get campaign status and timeline
 */
export async function getCampaignStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { leadId: req.params.leadId },
      include: { lead: true },
    });

    if (!campaign) {
      res.status(404).json({ error: 'No campaign found for this lead' });
      return;
    }

    res.json({ campaign });
  } catch (error) {
    console.error('Get campaign status error:', error);
    res.status(500).json({ error: 'Failed to fetch campaign status' });
  }
}

/**
 * POST /api/campaigns/trigger-scheduler — Manually trigger the scheduler
 */
export async function triggerScheduler(req: any, res: Response): Promise<void> {
    // Vercel Cron auth
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized cron request' });
      return;
    }
  try {
    const results = await runScheduledFollowups();
    res.json(results);
  } catch (error) {
    console.error('Trigger scheduler error:', error);
    res.status(500).json({ error: 'Failed to trigger scheduler' });
  }
}
