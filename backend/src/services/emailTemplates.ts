import { EmailTemplate, Signature } from '@prisma/client';

interface TemplateData {
  company: string;
  contactPerson: string;
  serviceNeed?: string;
  country?: string;
  [key: string]: string | undefined;
}

/**
 * Replace {{field}} merge placeholders in text
 */
function replaceMergeFields(text: string, data: TemplateData): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    const value = data[field];
    return value !== undefined && value !== null ? value : match;
  });
}

/**
 * Get the subject line for a given campaign step
 */
export function getSubjectForStep(step: number, template: EmailTemplate): string {
  switch (step) {
    case 1: return template.introSubject;
    case 2: return template.followup1Subject;
    case 3: return template.followup2Subject;
    case 4: return template.followup3Subject;
    default: return template.introSubject;
  }
}

/**
 * Get the body content for a given campaign step
 */
export function getBodyForStep(step: number, template: EmailTemplate): string {
  switch (step) {
    case 1: return template.introBody;
    case 2: return template.followup1Body;
    case 3: return template.followup2Body;
    case 4: return template.followup3Body;
    default: return template.introBody;
  }
}

/**
 * Convert plain text to HTML paragraphs
 * Handles: paragraphs, bullet points, line breaks
 */
function textToHtml(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      if (!inList) {
        html += '<ul style="margin: 8px 0; padding-left: 20px;">';
        inList = true;
      }
      html += `<li style="margin: 4px 0; color: #374151;">${trimmed.substring(2)}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">${trimmed}</p>`;
    }
  }

  if (inList) {
    html += '</ul>';
  }

  return html;
}

/**
 * Build the HTML signature block
 */
function buildSignatureHtml(signature: Signature): string {
  let links: Array<{ label: string; url: string; icon?: string }> = [];
  try {
    links = typeof signature.links === 'string'
      ? JSON.parse(signature.links as string)
      : (signature.links as any[]);
  } catch {
    links = [];
  }

  const linkHtml = links
    .map(
      (link) =>
        `<a href="${link.url}" style="color: #6366F1; text-decoration: none; margin-right: 12px; font-size: 13px;">${link.label}</a>`
    )
    .join('');

  return `
    <table style="margin-top: 24px; border-top: 1px solid #E5E7EB; padding-top: 16px; width: 100%;">
      <tr>
        <td>
          <p style="margin: 0; font-weight: 600; color: #111827; font-size: 15px;">${signature.name}</p>
          ${signature.role ? `<p style="margin: 2px 0 0 0; color: #6B7280; font-size: 13px;">${signature.role}</p>` : ''}
          ${signature.tagline ? `<p style="margin: 6px 0 0 0; color: #9CA3AF; font-size: 12px; font-style: italic;">${signature.tagline}</p>` : ''}
          ${linkHtml ? `<p style="margin: 10px 0 0 0;">${linkHtml}</p>` : ''}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Wrap email content in a responsive HTML layout
 */
function wrapInLayout(bodyHtml: string, signatureHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #F9FAFB; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              ${bodyHtml}
              ${signatureHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Render a complete email for a given campaign step
 * Returns { subject, htmlBody }
 */
export function renderTemplate(
  step: number,
  template: EmailTemplate,
  data: TemplateData,
  signature: Signature
): { subject: string; htmlBody: string } {
  const rawSubject = getSubjectForStep(step, template);
  const rawBody = getBodyForStep(step, template);

  const subject = replaceMergeFields(rawSubject, data);
  const bodyText = replaceMergeFields(rawBody, data);

  const bodyHtml = textToHtml(bodyText);
  const signatureHtml = buildSignatureHtml(signature);
  const htmlBody = wrapInLayout(bodyHtml, signatureHtml);

  return { subject, htmlBody };
}
