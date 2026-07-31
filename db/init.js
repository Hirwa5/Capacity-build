/**
 * db/init.js
 * Run with: npm run db:init
 * Applies schema.sql to the configured PostgreSQL database and creates
 * a default System Admin account if one does not already exist.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function run() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Applying schema.sql ...');
  await pool.query(schemaSql);
  console.log('Schema applied successfully.');

  // Ensure a default department exists
  const deptResult = await pool.query(
    `INSERT INTO departments (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['Administration']
  );
  const departmentId = deptResult.rows[0].id;

  // Ensure a default admin user exists
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@capacitybuilding.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (existing.rows.length === 0) {
    const roleResult = await pool.query("SELECT id FROM roles WHERE role_name = 'Admin'");
    const roleId = roleResult.rows[0].id;
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, department_id, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
      ['System Administrator', adminEmail, passwordHash, departmentId, roleId]
    );
    console.log(`Default admin created -> email: ${adminEmail} | password: ${adminPassword}`);
    console.log('IMPORTANT: change this password immediately after first login.');
  } else {
    console.log('Default admin already exists, skipping seed.');
  }

  await pool.end();
  console.log('Database initialization complete.');
}

run().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
