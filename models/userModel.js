/**
 * models/userModel.js
 * All SQL access for the `users` table.
 */
const pool = require('../config/db');

const BASE_SELECT = `
  SELECT u.id, u.full_name, u.email, u.department_id, d.name AS department_name,
         u.role_id, r.role_name, u.is_active, u.created_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN departments d ON d.id = u.department_id
`;

async function findByEmail(email) {
  const result = await pool.query(
    `SELECT u.*, r.role_name FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(`${BASE_SELECT} WHERE u.id = $1`, [id]);
  return result.rows[0] || null;
}

async function findAll() {
  const result = await pool.query(`${BASE_SELECT} ORDER BY u.created_at DESC`);
  return result.rows;
}

async function findAssigneesByDepartment(departmentId) {
  const result = await pool.query(
    `${BASE_SELECT} WHERE u.department_id = $1 AND r.role_name = 'Assignee' AND u.is_active = TRUE
     ORDER BY u.full_name ASC`,
    [departmentId]
  );
  return result.rows;
}

async function create({ fullName, email, passwordHash, departmentId, roleId }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, department_id, role_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, full_name, email, department_id, role_id, is_active, created_at`,
    [fullName, email, passwordHash, departmentId, roleId]
  );
  return result.rows[0];
}

async function update(id, { fullName, email, departmentId, roleId, isActive }) {
  const result = await pool.query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name),
         email = COALESCE($3, email),
         department_id = COALESCE($4, department_id),
         role_id = COALESCE($5, role_id),
         is_active = COALESCE($6, is_active)
     WHERE id = $1
     RETURNING id, full_name, email, department_id, role_id, is_active, created_at`,
    [id, fullName, email, departmentId, roleId, isActive]
  );
  return result.rows[0] || null;
}

async function updatePassword(id, passwordHash) {
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

async function deactivate(id) {
  const result = await pool.query(
    `UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id, is_active`,
    [id]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

module.exports = {
  findByEmail,
  findById,
  findAll,
  findAssigneesByDepartment,
  create,
  update,
  updatePassword,
  deactivate,
  remove,
};
