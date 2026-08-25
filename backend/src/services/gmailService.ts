import { google } from 'googleapis';
import prisma from '../utils/prisma';

const OAuth2 = google.auth.OAuth2;

function getOAuth2Client() {
  return new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

/**
 * Generate the OAuth consent URL for one-time Gmail authorization
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  });
}

/**
 * Exchange the authorization code for tokens and store the refresh token
 */
export async function handleOAuthCallback(code: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (tokens.refresh_token) {
    await prisma.appSetting.upsert({
      where: { key: 'gmail_refresh_token' },
      update: { value: tokens.refresh_token },
      create: { key: 'gmail_refresh_token', value: tokens.refresh_token },
    });
  }

  if (tokens.access_token) {
    await prisma.appSetting.upsert({
      where: { key: 'gmail_access_token' },
      update: { value: tokens.access_token },
      create: { key: 'gmail_access_token', value: tokens.access_token },
    });
  }

  console.log('✅ Gmail OAuth tokens stored successfully');
}

/**
 * Get an authenticated Gmail client using stored refresh token
 */
async function getAuthenticatedClient() {
  const oauth2Client = getOAuth2Client();

  const refreshTokenSetting = await prisma.appSetting.findUnique({
    where: { key: 'gmail_refresh_token' },
  });

  if (!refreshTokenSetting) {
    throw new Error('Gmail not connected. Please complete OAuth setup first.');
  }

  oauth2Client.setCredentials({
    refresh_token: refreshTokenSetting.value,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Check if Gmail is connected (has refresh token)
 */
export async function isGmailConnected(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: 'gmail_refresh_token' },
  });
  return !!setting?.value;
}

/**
 * Build a raw RFC 2822 MIME message
 */
function buildRawEmail(
  to: string,
  subject: string,
  htmlBody: string,
  fromEmail: string,
  fromName: string,
  threadId?: string,
  inReplyTo?: string,
  references?: string
): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  let headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  // Threading headers for follow-ups
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    headers.push(`References: ${references}`);
  }

  const rawMessage = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    htmlBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return rawMessage;
}

/**
 * Send an email via Gmail API
 * Returns { threadId, messageId, smtpMessageId }
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  fromName: string = 'ProSource',
  threadId?: string,
  inReplyTo?: string,
  references?: string
): Promise<{ threadId: string; messageId: string; smtpMessageId: string }> {
  const gmail = await getAuthenticatedClient();

  // Get the authenticated user's email
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const fromEmail = profile.data.emailAddress || '';

  const rawMessage = buildRawEmail(
    to,
    subject,
    htmlBody,
    fromEmail,
    fromName,
    threadId,
    inReplyTo,
    references
  );

  // Base64url encode
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sendParams: any = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  };

  // If threading, include threadId
  if (threadId) {
    sendParams.requestBody.threadId = threadId;
  }

  const result = await gmail.users.messages.send(sendParams);

  const sentMessageId = result.data.id || '';
  const sentThreadId = result.data.threadId || '';

  // Fetch the SMTP Message-ID for threading
  const smtpMessageId = await getSmtpMessageId(sentMessageId);

  return {
    threadId: sentThreadId,
    messageId: sentMessageId,
    smtpMessageId,
  };
}

/**
 * Get the SMTP Message-ID header from a Gmail message
 */
export async function getSmtpMessageId(gmailMessageId: string): Promise<string> {
  const gmail = await getAuthenticatedClient();

  const message = await gmail.users.messages.get({
    userId: 'me',
    id: gmailMessageId,
    format: 'metadata',
    metadataHeaders: ['Message-ID'],
  });

  const messageIdHeader = message.data.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === 'message-id'
  );

  return messageIdHeader?.value || '';
}

/**
 * Fetch all replies in a Gmail thread
 * Returns parsed messages with stripped quoted text
 */
export async function fetchThreadReplies(
  threadId: string
): Promise<
  Array<{
    gmailMessageId: string;
    fromEmail: string;
    fromName: string;
    subject: string;
    body: string;
    bodyHtml: string;
    receivedAt: Date;
    isSent: boolean;
  }>
> {
  const gmail = await getAuthenticatedClient();
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const myEmail = profile.data.emailAddress?.toLowerCase() || '';

  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const messages = thread.data.messages || [];
  const parsedMessages = [];

  for (const message of messages) {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const from = getHeader('From');
    const subject = getHeader('Subject');
    const date = getHeader('Date');

    // Parse from field: "Name <email>" or just "email"
    const fromMatch = from.match(/^(?:"?(.+?)"?\s)?<?([^>]+)>?$/);
    const fromName = fromMatch?.[1] || '';
    const fromEmail = (fromMatch?.[2] || from).toLowerCase();

    // Determine if this is a sent message
    const isSent = fromEmail === myEmail;

    // Extract body
    let body = '';
    let bodyHtml = '';

    function extractParts(part: any) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        part.parts.forEach(extractParts);
      }
    }

    if (message.payload) {
      extractParts(message.payload);
    }

    // Strip quoted text from replies
    body = stripQuotedText(body);

    parsedMessages.push({
      gmailMessageId: message.id || '',
      fromEmail,
      fromName,
      subject,
      body,
      bodyHtml,
      receivedAt: new Date(date),
      isSent,
    });
  }

  return parsedMessages;
}

/**
 * Strip quoted text from email replies
 * Handles common patterns: "On ... wrote:", "> quoted text", "------"
 */
function stripQuotedText(text: string): string {
  // Split on common reply patterns
  const patterns = [
    /^On .+ wrote:$/m, // "On Mon, Jan 1 ... wrote:"
    /^-{3,}\s*Original Message\s*-{3,}$/im, // --- Original Message ---
    /^-{3,}\s*Forwarded message\s*-{3,}$/im,
    /^>{1,}\s/m, // "> quoted text" at start of line
    /^From:\s/m, // "From: ..." header in forwarded
  ];

  let result = text;
  for (const pattern of patterns) {
    const match = result.search(pattern);
    if (match > 0) {
      result = result.substring(0, match).trim();
    }
  }

  // Remove trailing empty lines
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Get the user's Gmail email address
 */
export async function getMyEmail(): Promise<string> {
  const gmail = await getAuthenticatedClient();
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return profile.data.emailAddress || '';
}
