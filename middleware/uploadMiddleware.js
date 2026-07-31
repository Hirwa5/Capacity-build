/**
 * middleware/uploadMiddleware.js
 * Handles disk storage for brief attachments (submitted by Requester)
 * and deliverable attachments (uploaded by Service Lead / Assignee).
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BRIEFS_DIR = path.join(__dirname, '..', 'uploads', 'briefs');
const DELIVERABLES_DIR = path.join(__dirname, '..', 'uploads', 'deliverables');

[BRIEFS_DIR, DELIVERABLES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function makeStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname);
      const safeBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 60);
      cb(null, `${Date.now()}-${uniqueSuffix}-${safeBase}${ext}`);
    },
  });
}

// Allow common document/image/archive types used for briefs and deliverables
const ALLOWED_EXT = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.txt', '.csv',
]);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXT.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not allowed.`));
  }
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const uploadBrief = multer({
  storage: makeStorage(BRIEFS_DIR),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const uploadDeliverable = multer({
  storage: makeStorage(DELIVERABLES_DIR),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = { uploadBrief, uploadDeliverable, BRIEFS_DIR, DELIVERABLES_DIR };
