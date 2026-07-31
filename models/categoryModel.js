/**
 * models/categoryModel.js
 * All SQL access for the `categories` table (Service Categories).
 */
const pool = require('../config/db');

async function findAll() {
  const result = await pool.query(`
    SELECT c.*, d.name AS department_name
    FROM categories c
    JOIN departments d ON d.id = c.department_id
    ORDER BY d.name ASC, c.category_name ASC
  `);
  return result.rows;
}

async function findByDepartment(departmentId) {
  const result = await pool.query(
    'SELECT * FROM categories WHERE department_id = $1 ORDER BY category_name ASC',
    [departmentId]
  );
  return result.rows;
}

async function findById(id) {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create({ departmentId, categoryName, description }) {
  const result = await pool.query(
    `INSERT INTO categories (department_id, category_name, description)
     VALUES ($1, $2, $3) RETURNING *`,
    [departmentId, categoryName, description || null]
  );
  return result.rows[0];
}

async function update(id, { categoryName, description, departmentId }) {
  const result = await pool.query(
    `UPDATE categories
     SET category_name = COALESCE($2, category_name),
         description = COALESCE($3, description),
         department_id = COALESCE($4, department_id)
     WHERE id = $1
     RETURNING *`,
    [id, categoryName, description, departmentId]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
}

module.exports = { findAll, findByDepartment, findById, create, update, remove };
