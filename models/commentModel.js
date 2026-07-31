/**
 * models/commentModel.js
 * All SQL access for the `request_comments` table.
 */
const pool = require('../config/db');

async function findByRequest(requestId) {
  const result = await pool.query(
    `SELECT rc.*, u.full_name AS author_name, u.email AS author_email
     FROM request_comments rc
     JOIN users u ON u.id = rc.user_id
     WHERE rc.request_id = $1
     ORDER BY rc.created_at ASC`,
    [requestId]
  );
  return result.rows;
}

async function create({ requestId, userId, message, attachmentUrl }) {
  const result = await pool.query(
    `INSERT INTO request_comments (request_id, user_id, message, attachment_url)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [requestId, userId, message || null, attachmentUrl || null]
  );
  return result.rows[0];
}

module.exports = { findByRequest, create };
