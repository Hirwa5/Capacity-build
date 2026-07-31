/**
 * controllers/authController.js
 * Handles login and "who am i" for corporate-email based authentication.
 * Self-registration is intentionally limited to the Requester role; Assignee
 * and Admin accounts are provisioned by the System Admin (see adminController).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role_name,
      department_id: user.department_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

async function register(req, res) {
  try {
    const { fullName, email, password, departmentId } = req.body;
    if (!fullName || !email || !password || !departmentId) {
      return res.status(400).json({ error: 'fullName, email, password and departmentId are required.' });
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Self-registration is always as Requester (Standard Staff).
    const pool = require('../config/db');
    const roleResult = await pool.query("SELECT id FROM roles WHERE role_name = 'Requester'");
    const roleId = roleResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.create({ fullName, email, passwordHash, departmentId, roleId });

    const fullUser = await userModel.findById(user.id);
    const token = signToken({ ...fullUser, role_name: 'Requester' });

    return res.status(201).json({ token, user: fullUser });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Failed to register user.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await userModel.findByEmail(email);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = signToken(user);
    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Failed to log in.' });
  }
}

async function me(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
}

module.exports = { register, login, me };
