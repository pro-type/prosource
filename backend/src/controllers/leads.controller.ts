import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * GET /api/leads — List leads with search, filter, pagination
 */
export async function getLeads(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const archived = req.query.archived === 'true';

    const where: any = {
      isArchived: archived,
    };

    if (search) {
      where.OR = [
        { company: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              status: true,
              currentStep: true,
              nextFollowupDue: true,
              introEmailSentAt: true,
              followup1SentAt: true,
              followup2SentAt: true,
              followup3SentAt: true,
              responseReceivedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
}

/**
 * GET /api/leads/stats — Aggregate lead counts by status
 */
export async function getLeadStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [total, byStatus] = await Promise.all([
      prisma.lead.count({ where: { isArchived: false } }),
      prisma.lead.groupBy({
        by: ['status'],
        _count: true,
        where: { isArchived: false },
      }),
    ]);

    const stats: Record<string, number> = { total };
    byStatus.forEach((s) => {
      stats[s.status] = s._count;
    });

    // Also get active campaigns count
    const activeCampaigns = await prisma.emailCampaign.count({
      where: { status: 'active' },
    });

    stats.activeCampaigns = activeCampaigns;

    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

/**
 * GET /api/leads/:id — Single lead with campaign + replies
 */
export async function getLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: true,
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json({ lead });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
}

/**
 * POST /api/leads — Create single lead
 */
export async function createLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { company, contactPerson, email, phone, country, serviceNeed, notes, source } = req.body;

    if (!company || !contactPerson || !email) {
      res.status(400).json({ error: 'Company, contact person, and email are required' });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        company,
        contactPerson,
        email,
        phone: phone || null,
        country: country || null,
        serviceNeed: serviceNeed || null,
        notes: notes || null,
        source: source || 'manual',
      },
    });

    res.status(201).json({ lead });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
}

/**
 * POST /api/leads/bulk — Bulk import leads from JSON array
 */
export async function bulkImportLeads(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      res.status(400).json({ error: 'Leads array is required and must not be empty' });
      return;
    }

    const validLeads = leads
      .filter((l: any) => l.company && l.contactPerson && l.email)
      .map((l: any) => ({
        company: l.company,
        contactPerson: l.contactPerson,
        email: l.email,
        phone: l.phone || null,
        country: l.country || null,
        serviceNeed: l.serviceNeed || null,
        notes: l.notes || null,
        source: 'csv_import',
      }));

    if (validLeads.length === 0) {
      res.status(400).json({
        error: 'No valid leads found. Each lead must have company, contactPerson, and email.',
      });
      return;
    }

    const result = await prisma.lead.createMany({
      data: validLeads,
      skipDuplicates: true,
    });

    res.status(201).json({
      imported: result.count,
      total: leads.length,
      skipped: leads.length - validLeads.length,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
}

/**
 * PUT /api/leads/:id — Update lead fields
 */
export async function updateLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { company, contactPerson, email, phone, country, serviceNeed, notes, status } = req.body;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(company !== undefined && { company }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(country !== undefined && { country }),
        ...(serviceNeed !== undefined && { serviceNeed }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
      },
      include: { campaign: true },
    });

    res.json({ lead });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
}

/**
 * DELETE /api/leads/:id — Archive or hard-delete a lead
 */
export async function deleteLead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const hard = req.query.hard === 'true';

    if (hard) {
      await prisma.lead.delete({ where: { id: req.params.id } });
      res.json({ message: 'Lead permanently deleted' });
    } else {
      await prisma.lead.update({
        where: { id: req.params.id },
        data: { isArchived: true },
      });
      res.json({ message: 'Lead archived' });
    }
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
}
