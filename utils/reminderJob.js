/**
 * utils/reminderJob.js
 * Periodically scans for requests due within 24h (or overdue) that
 * haven't been flagged yet, and emails whoever is responsible for
 * acting on them:
 *   - PENDING (unclaimed)   -> every Assignee in the target department
 *   - IN_PROGRESS (claimed) -> the assignee who claimed it
 * Each request only ever triggers one reminder (tracked via reminder_sent).
 */
const requestModel = require('../models/requestModel');
const userModel = require('../models/userModel');
const { dueSoonReminderEmail } = require('./mailer');

async function checkAndSendReminders() {
  try {
    const dueSoon = await requestModel.findDueSoonUnnotified();

    for (const r of dueSoon) {
      if (r.status === 'PENDING') {
        const assignees = await userModel.findAssigneesByDepartment(r.target_department_id);
        for (const a of assignees) {
          await dueSoonReminderEmail({
            to: a.email,
            recipientName: a.full_name,
            requestTitle: r.title,
            requestId: r.id,
            dueDate: r.requested_due_date,
            unclaimed: true,
          });
        }
      } else if (r.status === 'IN_PROGRESS' && r.assigned_to) {
        const assignee = await userModel.findById(r.assigned_to);
        if (assignee) {
          await dueSoonReminderEmail({
            to: assignee.email,
            recipientName: assignee.full_name,
            requestTitle: r.title,
            requestId: r.id,
            dueDate: r.requested_due_date,
            unclaimed: false,
          });
        }
      }

      await requestModel.markReminderSent(r.id);
    }

    if (dueSoon.length) {
      console.log(`[reminderJob] Sent due-soon reminders for ${dueSoon.length} request(s).`);
    }
  } catch (err) {
    console.error('[reminderJob] Failed to run reminder check:', err.message);
  }
}

/** Starts the recurring check: first run 30s after boot, then every 15 minutes. */
function startReminderJob() {
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;
  setTimeout(checkAndSendReminders, 30 * 1000);
  setInterval(checkAndSendReminders, CHECK_INTERVAL_MS);
}

module.exports = { startReminderJob, checkAndSendReminders };