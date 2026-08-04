/**
 * models/requestModel.js
 * All SQL access for the `requests` table.
 * Handles the primary service-desk queue sorting rules:
 *   1. requested_due_date ASC  (earliest deadline first)
 *   2. created_at ASC          (FIFO tie-breaker)
 */
const pool = require('../config/db');

const BASE_SELECT = `
  SELECT req.*,
         reqr.full_name  AS requester_name,
         reqr.email      AS requester_email,
         td.name         AS target_department_name,
         cat.category_name,
         asg.full_name   AS assignee_name
  FROM requests req
  JOIN users reqr        ON reqr.id = req.requester_id
  JOIN departments td     ON td.id = req.target_department_id
  LEFT JOIN categories cat ON cat.id = req.category_id
  LEFT JOIN users asg      ON asg.id = req.assigned_to
`;

/** Requester's own submitted requests. */
async function findByRequester(requesterId) {
  const result = await pool.query(
    `${BASE_SELECT} WHERE req.requester_id = $1
     ORDER BY req.requested_due_date ASC, req.created_at ASC`,
    [requesterId]
  );
  return result.rows;
}

/**
 * Service Lead queue for a given department — the primary sorted view.
 * Pass departmentId = null to return the queue across ALL departments
 * (used for Admin, who has system-wide oversight).
 */
async function findQueueByDepartment(departmentId, { statusFilter } = {}) {
  const params = [];
  const clauses = [];

  if (departmentId !== null && departmentId !== undefined) {
    params.push(departmentId);
    clauses.push(`req.target_department_id = $${params.length}`);
  }

  if (Array.isArray(statusFilter)) {
    params.push(statusFilter);
    clauses.push(`req.status = ANY($${params.length})`);
  } else if (statusFilter) {
    params.push(statusFilter);
    clauses.push(`req.status = $${params.length}`);
  } else {
    clauses.push("req.status IN ('PENDING','IN_PROGRESS')");
  }

  const result = await pool.query(
    `${BASE_SELECT}
     WHERE ${clauses.join(' AND ')}
     ORDER BY req.requested_due_date ASC, req.created_at ASC`,
    params
  );
  return result.rows;

}

async function findById(id) {
  const result = await pool.query(`${BASE_SELECT} WHERE req.id = $1`, [id]);
  return result.rows[0] || null;
}

async function create({
  requesterId, targetDepartmentId, categoryId, title, description,
  requestedDueDate, attachmentUrl,
}) {
  const result = await pool.query(
    `INSERT INTO requests
       (requester_id, target_department_id, category_id, title, description,
        requested_due_date, attachment_url, status, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', 'NORMAL')
     RETURNING *`,
    [requesterId, targetDepartmentId, categoryId, title, description, requestedDueDate, attachmentUrl]
  );
  return result.rows[0];
}

/** Service Lead claims a task: [ Start Working ] */
async function startWorking(id, assigneeId) {
  const result = await pool.query(
    `UPDATE requests
     SET status = 'IN_PROGRESS', assigned_to = $2
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *`,
    [id, assigneeId]
  );
  return result.rows[0] || null;
}

/** Service Lead delivers the finished file: [ Complete & Deliver ] */
async function completeAndDeliver(id, completedAttachmentUrl) {
  const result = await pool.query(
    `UPDATE requests
     SET status = 'COMPLETED', completed_attachment_url = $2
     WHERE id = $1 AND status = 'IN_PROGRESS'
     RETURNING *`,
    [id, completedAttachmentUrl]
  );
  return result.rows[0] || null;
}

/** Service Lead declines a task before starting it (distinct from a requester's cancel). */
async function decline(id, assigneeId) {
  const result = await pool.query(
    `UPDATE requests
     SET status = 'DECLINED'
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

async function cancel(id, requesterId) {
  const result = await pool.query(
    `UPDATE requests
     SET status = 'CANCELLED'
     WHERE id = $1 AND requester_id = $2 AND status = 'PENDING'
     RETURNING *`,
    [id, requesterId]
  );
  return result.rows[0] || null;
}

async function deleteCompleted(id, requesterId) {
  const result = await pool.query(
    `DELETE FROM requests
     WHERE id = $1 AND requester_id = $2 AND status = 'COMPLETED'
     RETURNING id`,
    [id, requesterId]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM requests WHERE id = $1', [id]);
}

/** High-level workload metrics for the Admin dashboard. */
async function systemMetrics() {
  const result = await pool.query(`
    SELECT
      COUNT(*) AS total_requests,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress_count,
      COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_count,
      COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
      COUNT(*) FILTER (
        WHERE status IN ('PENDING','IN_PROGRESS') AND requested_due_date <= NOW() + INTERVAL '24 hours'
      ) AS urgent_count,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status = 'COMPLETED') AS avg_completion_hours
    FROM requests
  `);
  return result.rows[0];
}
/** Requests due within 24h (or already overdue) that haven't triggered a reminder yet. */
async function findDueSoonUnnotified() {
  const result = await pool.query(`
    ${BASE_SELECT}
    WHERE req.status IN ('PENDING', 'IN_PROGRESS')
      AND req.reminder_sent = FALSE
      AND req.requested_due_date <= NOW() + INTERVAL '24 hours'
    ORDER BY req.requested_due_date ASC
  `);
  return result.rows;
}

/** Marks a request so it won't trigger the same due-soon reminder again. */
async function markReminderSent(id) {
  await pool.query('UPDATE requests SET reminder_sent = TRUE WHERE id = $1', [id]);
}
module.exports = {
  findByRequester,
  findQueueByDepartment,
  findById,
  create,
  startWorking,
  completeAndDeliver,
  decline,
  cancel,
  deleteCompleted,
  remove,
  systemMetrics,
  findDueSoonUnnotified,
  markReminderSent,

};
