import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * GET /api/signatures — List all signatures
 */
export async function getSignatures(req: AuthRequest, res: Response): Promise<void> {
  try {
    const signatures = await prisma.signature.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ signatures });
  } catch (error) {
    console.error('Get signatures error:', error);
    res.status(500).json({ error: 'Failed to fetch signatures' });
  }
}

/**
 * POST /api/signatures — Create signature
 */
export async function createSignature(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, role, tagline, links, isDefault } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.signature.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const signature = await prisma.signature.create({
      data: {
        name,
        role: role || null,
        tagline: tagline || null,
        links: links ? JSON.stringify(links) : '[]',
        isDefault: isDefault !== undefined ? isDefault : true,
      },
    });

    res.status(201).json({ signature });
  } catch (error) {
    console.error('Create signature error:', error);
    res.status(500).json({ error: 'Failed to create signature' });
  }
}

/**
 * PUT /api/signatures/:id — Update signature
 */
export async function updateSignature(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, role, tagline, links, isDefault } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.signature.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const signature = await prisma.signature.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(tagline !== undefined && { tagline }),
        ...(links !== undefined && { links: JSON.stringify(links) }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    res.json({ signature });
  } catch (error) {
    console.error('Update signature error:', error);
    res.status(500).json({ error: 'Failed to update signature' });
  }
}

/**
 * DELETE /api/signatures/:id — Delete signature
 */
export async function deleteSignature(req: AuthRequest, res: Response): Promise<void> {
  try {
    await prisma.signature.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Signature deleted' });
  } catch (error) {
    console.error('Delete signature error:', error);
    res.status(500).json({ error: 'Failed to delete signature' });
  }
}
