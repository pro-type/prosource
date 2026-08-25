import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getAuthUrl, handleOAuthCallback, isGmailConnected } from '../services/gmailService';

/**
 * GET /api/gmail/auth-url — Get the OAuth consent URL
 */
export async function getGmailAuthUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch (error) {
    console.error('Get auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
}

/**
 * GET /api/gmail/callback — Handle OAuth callback
 */
export async function gmailCallback(req: Request, res: Response): Promise<void> {
  try {
    const code = req.query.code as string;

    if (!code) {
      res.status(400).json({ error: 'Authorization code is required' });
      return;
    }

    await handleOAuthCallback(code);

    // Redirect back to the frontend settings page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?gmail=connected`);
  } catch (error) {
    console.error('Gmail callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?gmail=error`);
  }
}

/**
 * GET /api/gmail/status — Check Gmail connection status
 */
export async function getGmailStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const connected = await isGmailConnected();
    res.json({ connected });
  } catch (error) {
    console.error('Gmail status error:', error);
    res.status(500).json({ error: 'Failed to check Gmail status' });
  }
}
