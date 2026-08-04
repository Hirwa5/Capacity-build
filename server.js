/**
 * server.js
 * Express application entry point for CAPACITY BUILDING
 * (Internal Service Desk and Task Allocation Portal).
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { startReminderJob } = require('./utils/reminderJob');


const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend (login.html, dashboard.html, admin.html)
app.use('/views', express.static(path.join(__dirname, 'views')));
// Serve uploaded briefs / deliverables (auth-gated download route lives in
// requestRoutes; this static mount is only used for inline previews if needed)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.redirect('/views/login.html'));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'CAPACITY BUILDING' }));

app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Centralized error handler (also catches Multer file errors)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.message && err.message.includes('not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File exceeds the 25MB limit.' });
  }
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CAPACITY BUILDING server running on http://localhost:${PORT}`);
  startReminderJob();
});

module.exports = app;
