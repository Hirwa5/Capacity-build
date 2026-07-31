/**
 * config/db.js
 * Centralized PostgreSQL connection pool.
 * All models import this pool rather than creating their own connections.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'isrs_capacity_building',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Prevents an idle client error from crashing the whole process
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
