/**
 * controllers/commentController.js
 * Two-way task-level discussion threads: [ Post Comment ]
 */
const commentModel = require('../models/commentModel');
const requestModel = require('../models/requestModel');
const userModel = require('../models/userModel');
const { commentPostedEmail } = require('../utils/mailer');

async function listComments(req, res) {
  try {
    const requestRow = await requestModel.findById(req.params.id);
    if (!requestRow) return res.status(404).json({ error: 'Request not found.' });

    const isOwner = requestRow.requester_id === req.user.id;
    const isDeptStaff = req.user.department_id === requestRow.target_department_id;
    const isAdmin = req.user.role === 'Admin';
    if (!isOwner && !isDeptStaff && !isAdmin) {
      return res.status(403).json({ error: 'You do not have access to this thread.' });
    }

    const comments = await commentModel.findByRequest(req.params.id);
    return res.json({ comments });
  } catch (err) {
    console.error('listComments error:', err);
    return res.status(500).json({ error: 'Failed to load comments.' });
  }
}

async function postComment(req, res) {
  try {
    const { message } = req.body;
    if (!message && !req.file) {
      return res.status(400).json({ error: 'A message or attachment is required.' });
    }

    const requestRow = await requestModel.findById(req.params.id);
    if (!requestRow) return res.status(404).json({ error: 'Request not found.' });

    const isOwner = requestRow.requester_id === req.user.id;
    const isDeptStaff = req.user.department_id === requestRow.target_department_id;
    const isAdmin = req.user.role === 'Admin';
    if (!isOwner && !isDeptStaff && !isAdmin) {
      return res.status(403).json({ error: 'You do not have access to this thread.' });
    }

    const attachmentUrl = req.file ? `/uploads/briefs/${req.file.filename}` : null;
    const comment = await commentModel.create({
      requestId: req.params.id,
      userId: req.user.id,
      message,
      attachmentUrl,
    });
    const isCommenterRequester = req.user.id === requestRow.requester_id;
    let recipients = [];
    if (isCommenterRequester) {
      // notify the assignee if one has claimed it, otherwise the whole department
      recipients = requestRow.assigned_to
        ? [await userModel.findById(requestRow.assigned_to)]
        : await userModel.findAssigneesByDepartment(requestRow.target_department_id);
    } else {
      recipients = [await userModel.findById(requestRow.requester_id)];
    }
    recipients.filter(Boolean).forEach((r) => {
      commentPostedEmail({
        to: r.email,
        recipientName: r.full_name,
        authorName: req.user.full_name,
        requestTitle: requestRow.title,
        requestId: requestRow.id,
        message: comment.message,
      });
    });
    return res.status(201).json({ comment });
  } catch (err) {
    console.error('postComment error:', err);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
}

module.exports = { listComments, postComment };
