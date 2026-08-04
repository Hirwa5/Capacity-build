/**
 * utils/mailer.js
 * Sends automated notification emails via the Brevo (Sendinblue)
 * transactional email HTTP API — no persistent SMTP connection,
 * which makes it reliable on serverless hosts like Vercel.
 * Every email is rendered inside a branded "card" template with
 * the company logo and name.
 */
require('dotenv').config();

/** Wraps a message body in a branded, table-based HTML card (safe across email clients). */
function renderEmailCard({ heading, bodyHtml, ctaLabel, ctaUrl }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  const logoUrl = `${base}/views/assets/logo.jpg`;
  const companyName = process.env.MAIL_FROM_NAME || 'Green Starz Impakt Hub';

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0B3A20;padding:20px 24px;" align="left">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;">
                    <img src="${logoUrl}" alt="${companyName}" width="36" height="36" style="border-radius:50%;display:block;">
                  </td>
                  <td>
                    <span style="color:#FFFFFF;font-size:15px;font-weight:bold;letter-spacing:0.3px;">${companyName.toUpperCase()}</span><br/>
                    <span style="color:#7FDDA6;font-size:11px;">CAPACITY BUILDING — Service Desk</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h2 style="margin:0 0 12px;color:#0B3A20;font-size:18px;">${heading}</h2>
              <div style="color:#334155;font-size:14px;line-height:1.6;">${bodyHtml}</div>
              ${ctaUrl ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="border-radius:8px;background:#1E7A46;">
                    <a href="${ctaUrl}" style="display:inline-block;padding:11px 22px;color:#FFFFFF;font-size:14px;font-weight:bold;text-decoration:none;border-radius:8px;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
              <p style="margin:0;color:#94A3B8;font-size:11px;">This is an automated notification from ${companyName} — CAPACITY BUILDING. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/**
 * Sends a branded card email via the Brevo API.
 * Failures are logged but never thrown — a mail outage must not block
 * the core workflow (status updates should still succeed).
 */
async function sendMail({ to, subject, html }) {
  if (!process.env.BREVO_API_KEY) {
    console.warn(`[mailer] BREVO_API_KEY not configured — skipping email to ${to}: "${subject}"`);
    return { skipped: true };
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: process.env.MAIL_FROM_NAME || 'CAPACITY BUILDING',
          email: process.env.MAIL_FROM_EMAIL || 'no-reply@example.com',
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[mailer] Brevo API error (${res.status}) sending to ${to}:`, errText);
      return { error: errText };
    }
    return await res.json();
  } catch (err) {
    console.error(`[mailer] Failed to send email to ${to}:`, err.message);
    return { error: err.message };
  }
}

function statusChangeEmail({ to, requesterName, requestTitle, requestId, newStatus }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  const statusLabel = newStatus.replace('_', ' ');
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] Request #${requestId} is now ${statusLabel}`,
    html: renderEmailCard({
      heading: `Request status updated`,
      bodyHtml: `<p>Hi ${requesterName},</p><p>Your request "<strong>${requestTitle}</strong>" (Ref #${requestId}) status has changed to <strong>${statusLabel}</strong>.</p>`,
      ctaLabel: 'View your request',
      ctaUrl: `${base}/views/dashboard.html?request=${requestId}`,
    }),
  });
}

function deliverableReadyEmail({ to, requesterName, requestTitle, requestId, downloadUrl }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] Deliverable ready for Request #${requestId}`,
    html: renderEmailCard({
      heading: `Your deliverable is ready`,
      bodyHtml: `<p>Hi ${requesterName},</p><p>Your request "<strong>${requestTitle}</strong>" (Ref #${requestId}) has been completed and is ready to download.</p>`,
      ctaLabel: 'Download Deliverable',
      ctaUrl: `${base}${downloadUrl}`,
    }),
  });
}

function newRequestEmail({ to, assigneeName, requesterName, requestTitle, requestId }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] New request #${requestId}: ${requestTitle}`,
    html: renderEmailCard({
      heading: `New request in your queue`,
      bodyHtml: `<p>Hi ${assigneeName},</p><p><strong>${requesterName}</strong> submitted a new request: "<strong>${requestTitle}</strong>" (Ref #${requestId}).</p>`,
      ctaLabel: 'View in queue',
      ctaUrl: `${base}/views/dashboard.html?request=${requestId}`,
    }),
  });
}

function commentPostedEmail({ to, recipientName, authorName, requestTitle, requestId, message }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] New comment on request #${requestId}`,
    html: renderEmailCard({
      heading: `New comment`,
      bodyHtml: `<p>Hi ${recipientName},</p><p><strong>${authorName}</strong> commented on "<strong>${requestTitle}</strong>" (Ref #${requestId}):</p><p style="padding:10px;background:#f5f5f5;border-radius:6px;">${message || '(attachment only)'}</p>`,
      ctaLabel: 'View and reply',
      ctaUrl: `${base}/views/dashboard.html?request=${requestId}`,
    }),
  });
}

function dueSoonReminderEmail({ to, recipientName, requestTitle, requestId, dueDate, unclaimed }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  const dueLabel = new Date(dueDate).toLocaleString();
  const statusNote = unclaimed
    ? 'This request is still unclaimed in your department queue.'
    : 'This request is assigned to you and still in progress.';
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] Reminder: Request #${requestId} is due soon`,
    html: renderEmailCard({
      heading: `Deadline reminder`,
      bodyHtml: `<p>Hi ${recipientName},</p><p>"<strong>${requestTitle}</strong>" (Ref #${requestId}) is due on <strong>${dueLabel}</strong> — within the next 24 hours, or already overdue.</p><p>${statusNote}</p>`,
      ctaLabel: 'Open the request',
      ctaUrl: `${base}/views/dashboard.html?request=${requestId}`,
    }),
  });
}

module.exports = {
  sendMail,
  statusChangeEmail,
  deliverableReadyEmail,
  newRequestEmail,
  commentPostedEmail,
  dueSoonReminderEmail,
};