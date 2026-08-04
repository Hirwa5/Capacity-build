/**
 * utils/mailer.js
 * Sends automated status-change notification emails to the requester's
 * login email address.
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

/**
 * Sends a plain, functional notification email.
 * Failures are logged but never thrown — a mail outage must not block
 * the core workflow (status updates should still succeed).
 */
async function sendMail({ to, subject, html }) {
  if (!process.env.SMTP_HOST) {
    console.warn(`[mailer] SMTP not configured — skipping email to ${to}: "${subject}"`);
    return { skipped: true };
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'CAPACITY BUILDING <no-reply@example.com>',
      to,
      subject,
      html,
    });
    return info;
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
    html: `
      <p>Hi ${requesterName},</p>
      <p>Your request "<strong>${requestTitle}</strong>" (Ref #${requestId}) status has changed to
      <strong>${statusLabel}</strong>.</p>
      <p><a href="${base}/views/dashboard.html?request=${requestId}">View your request</a></p>
      <p>— CAPACITY BUILDING Service Desk</p>
    `,
  });
}

function deliverableReadyEmail({ to, requesterName, requestTitle, requestId, downloadUrl }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] Deliverable ready for Request #${requestId}`,
    html: `
      <p>Hi ${requesterName},</p>
      <p>Your request "<strong>${requestTitle}</strong>" (Ref #${requestId}) has been completed.</p>
      <p><a href="${base}${downloadUrl}">Download Deliverable</a></p>
      <p><a href="${base}/views/dashboard.html?request=${requestId}">View request details</a></p>
      <p>— CAPACITY BUILDING Service Desk</p>
    `,
  });
}
function newRequestEmail({ to, assigneeName, requesterName, requestTitle, requestId }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] New request #${requestId}: ${requestTitle}`,
    html: `
      <p>Hi ${assigneeName},</p>
      <p><strong>${requesterName}</strong> submitted a new request: "<strong>${requestTitle}</strong>" (Ref #${requestId}).</p>
      <p><a href="${base}/views/dashboard.html?request=${requestId}">View in queue</a></p>
      <p>— CAPACITY BUILDING Service Desk</p>
    `,
  });
}

function commentPostedEmail({ to, recipientName, authorName, requestTitle, requestId, message }) {
  const base = process.env.APP_BASE_URL || 'http://localhost:4000';
  return sendMail({
    to,
    subject: `[CAPACITY BUILDING] New comment on request #${requestId}`,
    html: `
      <p>Hi ${recipientName},</p>
      <p><strong>${authorName}</strong> commented on "<strong>${requestTitle}</strong>" (Ref #${requestId}):</p>
      <p style="padding:10px;background:#f5f5f5;border-radius:6px;">${message || '(attachment only)'}</p>
      <p><a href="${base}/views/dashboard.html?request=${requestId}">View and reply</a></p>
      <p>— CAPACITY BUILDING Service Desk</p>
    `,
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
    html: `
      <p>Hi ${recipientName},</p>
      <p>This is a reminder that "<strong>${requestTitle}</strong>" (Ref #${requestId}) is due on
      <strong>${dueLabel}</strong> — within the next 24 hours, or already overdue.</p>
      <p>${statusNote}</p>
      <p><a href="${base}/views/dashboard.html?request=${requestId}">Open the request</a></p>
      <p>— CAPACITY BUILDING Service Desk</p>
    `,
  });
}
module.exports = { sendMail, statusChangeEmail, deliverableReadyEmail, newRequestEmail, commentPostedEmail, dueSoonReminderEmail };

