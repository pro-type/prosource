import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * GET /api/templates — List all templates
 */
export async function getTemplates(req: AuthRequest, res: Response): Promise<void> {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

/**
 * GET /api/templates/:id — Single template
 */
export async function getTemplate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({ template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

/**
 * POST /api/templates — Create template
 */
export async function createTemplate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      name,
      isDefault,
      introSubject,
      introBody,
      followup1Subject,
      followup1Body,
      followup2Subject,
      followup2Body,
      followup3Subject,
      followup3Body,
    } = req.body;

    if (!name || !introSubject || !introBody) {
      res.status(400).json({ error: 'Name, intro subject, and intro body are required' });
      return;
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        isDefault: isDefault || false,
        introSubject,
        introBody,
        followup1Subject: followup1Subject || '',
        followup1Body: followup1Body || '',
        followup2Subject: followup2Subject || '',
        followup2Body: followup2Body || '',
        followup3Subject: followup3Subject || '',
        followup3Body: followup3Body || '',
      },
    });

    res.status(201).json({ template });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
}

/**
 * PUT /api/templates/:id — Update template
 */
export async function updateTemplate(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { isDefault, ...updateData } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    res.json({ template });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
}

/**
 * DELETE /api/templates/:id — Delete template
 */
export async function deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
  try {
    await prisma.emailTemplate.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
}
