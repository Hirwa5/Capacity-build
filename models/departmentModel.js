/**
 * models/departmentModel.js
 * All SQL access for the `departments` table.
 */
const pool = require('../config/db');

async function findAll() {
  const result = await pool.query('SELECT * FROM departments ORDER BY name ASC');
  return result.rows;
}

async function findById(id) {
  const result = await pool.query('SELECT * FROM departments WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(name) {
  const result = await pool.query(
    'INSERT INTO departments (name) VALUES ($1) RETURNING *',
    [name]
  );
  return result.rows[0];
}

async function update(id, name) {
  const result = await pool.query(
    'UPDATE departments SET name = $2 WHERE id = $1 RETURNING *',
    [id, name]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM departments WHERE id = $1', [id]);
}

/** Basic workload metrics used by the Admin overview screen. */
async function workloadOverview() {
  const result = await pool.query(`
    SELECT d.id, d.name,
           COUNT(req.id) FILTER (WHERE req.status = 'PENDING') AS pending_count,
           COUNT(req.id) FILTER (WHERE req.status = 'IN_PROGRESS') AS in_progress_count,
           COUNT(req.id) FILTER (WHERE req.status = 'COMPLETED') AS completed_count,
           COUNT(req.id) FILTER (
             WHERE req.status IN ('PENDING','IN_PROGRESS')
               AND req.requested_due_date <= NOW() + INTERVAL '24 hours'
           ) AS urgent_count
    FROM departments d
    LEFT JOIN requests req ON req.target_department_id = d.id
    GROUP BY d.id, d.name
    ORDER BY d.name ASC
  `);
  return result.rows;
}

module.exports = { findAll, findById, create, update, remove, workloadOverview };
