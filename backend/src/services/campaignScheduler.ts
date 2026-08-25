import cron from 'node-cron';
import prisma from '../utils/prisma';
import { executeSendStep, syncRepliesForLead } from '../controllers/campaign.controller';

let schedulerTask: cron.ScheduledTask | null = null;

/**
 * Start the campaign scheduler cron job
 * Runs daily at the configured time (default 9 AM)
 */
export function startScheduler(): void {
  const cronExpression = process.env.SCHEDULER_CRON || '0 9 * * *';

  if (schedulerTask) {
    schedulerTask.stop();
  }

  schedulerTask = cron.schedule(cronExpression, async () => {
    console.log(`⏰ [${new Date().toISOString()}] Campaign scheduler running...`);
    await runScheduledFollowups();
  });

  console.log(`📅 Campaign scheduler started with cron: ${cronExpression}`);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('🛑 Campaign scheduler stopped');
  }
}

/**
 * Execute all due follow-ups
 * This is the core scheduler logic — finds campaigns with due follow-ups and sends them
 */
export async function runScheduledFollowups(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const now = new Date();
  const results = { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] };

  try {
    // Find all campaigns that have due follow-ups
    const dueCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: 'active',
        currentStep: { lt: 4 },
        nextFollowupDue: { lte: now },
      },
      include: {
        lead: true,
      },
      orderBy: {
        nextFollowupDue: 'asc',
      },
    });

    console.log(`📬 Found ${dueCampaigns.length} campaigns with due follow-ups`);

    for (const campaign of dueCampaigns) {
      results.processed++;

      try {
        // First, sync replies to check if the lead responded
        await syncRepliesForLead(campaign.leadId);

        // Re-fetch campaign status (might have changed after sync)
        const updatedCampaign = await prisma.emailCampaign.findUnique({
          where: { id: campaign.id },
        });

        // Skip if campaign is no longer active (e.g., reply detected)
        if (!updatedCampaign || updatedCampaign.status !== 'active') {
          console.log(`⏭️ Skipping ${campaign.lead.company} — campaign no longer active`);
          continue;
        }

        // Send the next follow-up
        await executeSendStep(campaign.leadId);
        results.succeeded++;
        console.log(`✅ Follow-up sent for ${campaign.lead.company} (${campaign.lead.email})`);

        // Rate limit: 2-second delay between sends
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        results.failed++;
        const errMsg = `Failed for ${campaign.lead.company}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errMsg);
        console.error(`❌ ${errMsg}`);
      }
    }

    // Update last run timestamp
    await prisma.appSetting.upsert({
      where: { key: 'scheduler_last_run' },
      update: { value: now.toISOString() },
      create: { key: 'scheduler_last_run', value: now.toISOString() },
    });

    console.log(
      `📊 Scheduler complete — Processed: ${results.processed}, Succeeded: ${results.succeeded}, Failed: ${results.failed}`
    );
  } catch (error) {
    console.error('💥 Scheduler error:', error);
    results.errors.push(
      `Scheduler error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return results;
}
