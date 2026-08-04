/**
 * controllers/requestController.js
 * Core service-desk workflow: submission, sorted queue retrieval,
 * claiming, and delivery of finished work.
 */
const path = require('path');
const requestModel = require('../models/requestModel');
const userModel = require('../models/userModel');
const { withBadge } = require('../utils/priority');
const { statusChangeEmail, deliverableReadyEmail } = require('../utils/mailer');

/** Requester: [ + Create Request ] -> [ Submit Request ] */
async function createRequest(req, res) {
  try {
    const { targetDepartmentId, categoryId, title, description, requestedDueDate } = req.body;
    if (!targetDepartmentId || !title || !requestedDueDate) {
      return res.status(400).json({ error: 'targetDepartmentId, title and requestedDueDate are required.' });
    }
    if (new Date(requestedDueDate) <= new Date()) {
      return res.status(400).json({ error: 'Required Due Date/Time must be in the future.' });
    }

    const attachmentUrl = req.file ? `/uploads/briefs/${req.file.filename}` : null;

    const created = await requestModel.create({
      requesterId: req.user.id,
      targetDepartmentId,
      categoryId: categoryId || null,
      title,
      description: description || null,
      requestedDueDate,
      attachmentUrl,
    });

    const full = await requestModel.findById(created.id);
    return res.status(201).json({ request: withBadge(full) });
  } catch (err) {
    console.error('createRequest error:', err);
    return res.status(500).json({ error: 'Failed to submit request.' });
  }
}

/** Requester: view personal task status list. */
async function myRequests(req, res) {
  try {
    const rows = await requestModel.findByRequester(req.user.id);
    return res.json({ requests: withBadge(rows) });
  } catch (err) {
    console.error('myRequests error:', err);
    return res.status(500).json({ error: 'Failed to load your requests.' });
  }
}

/**
 * Service Lead: sorted incoming queue for their department.
 * Primary sort: requested_due_date ASC. Secondary (FIFO): created_at ASC.
 * (Enforced at the SQL layer in requestModel.findQueueByDepartment.)
 */
async function departmentQueue(req, res) {
  try {
    const isAdmin = req.user.role === 'Admin';
    if (!isAdmin && !req.user.department_id) {
      return res.status(400).json({ error: 'Your account has no assigned department.' });
    }
    let statusFilter = req.query.status || null;
    // Admin's "Declined" tab shows both assignee-declined and requester-cancelled
    // requests together, since the two are treated as one bucket in the UI.
    if (isAdmin && statusFilter === 'DECLINED') {
      statusFilter = ['DECLINED', 'CANCELLED'];
    }
    // Admin sees every department's queue; Assignee sees only their own.
    const scopeDepartmentId = isAdmin ? null : req.user.department_id;
    const rows = await requestModel.findQueueByDepartment(scopeDepartmentId, { statusFilter });
    return res.json({ requests: withBadge(rows) });
  } catch (err) {
    console.error('departmentQueue error:', err);
    return res.status(500).json({ error: 'Failed to load department queue.' });
  }

}

async function getRequest(req, res) {
  try {
    const row = await requestModel.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Request not found.' });

    // Access control: requester who owns it, assignee in the target dept, or admin.
    const isOwner = row.requester_id === req.user.id;
    const isDeptStaff = req.user.department_id === row.target_department_id;
    const isAdmin = req.user.role === 'Admin';
    if (!isOwner && !isDeptStaff && !isAdmin) {
      return res.status(403).json({ error: 'You do not have access to this request.' });
    }

    return res.json({ request: withBadge(row) });
  } catch (err) {
    console.error('getRequest error:', err);
    return res.status(500).json({ error: 'Failed to load request.' });
  }
}

/** Service Lead: [ Start Working ] -> status becomes IN_PROGRESS + notify requester. */
async function startWorking(req, res) {
  try {
    const updated = await requestModel.startWorking(req.params.id, req.user.id);
    if (!updated) {
      return res.status(409).json({ error: 'Request is not available to be claimed (already claimed or not pending).' });
    }

    const requester = await userModel.findById(updated.requester_id);
    if (requester) {
      statusChangeEmail({
        to: requester.email,
        requesterName: requester.full_name,
        requestTitle: updated.title,
        requestId: updated.id,
        newStatus: 'IN_PROGRESS',
      });
    }

    return res.json({ request: withBadge(updated) });
  } catch (err) {
    console.error('startWorking error:', err);
    return res.status(500).json({ error: 'Failed to start working on request.' });
  }
}

/** Service Lead: [ Complete & Deliver ] -> uploads finished file, status becomes COMPLETED + notify. */
async function completeAndDeliver(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A deliverable file is required to complete this request.' });
    }
    const completedAttachmentUrl = `/uploads/deliverables/${req.file.filename}`;
    const updated = await requestModel.completeAndDeliver(req.params.id, completedAttachmentUrl);
    if (!updated) {
      return res.status(409).json({ error: 'Request must be IN_PROGRESS before it can be delivered.' });
    }

    const requester = await userModel.findById(updated.requester_id);
    if (requester) {
      deliverableReadyEmail({
        to: requester.email,
        requesterName: requester.full_name,
        requestTitle: updated.title,
        requestId: updated.id,
        downloadUrl: `/api/requests/${updated.id}/download`,
      });
    }

    return res.json({ request: withBadge(updated) });
  } catch (err) {
    console.error('completeAndDeliver error:', err);
    return res.status(500).json({ error: 'Failed to deliver request.' });
  }
}

/** Requester: [ Download Deliverable ] */
async function downloadDeliverable(req, res) {
  try {
    const row = await requestModel.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Request not found.' });
    if (!row.completed_attachment_url) {
      return res.status(404).json({ error: 'No deliverable has been uploaded yet.' });
    }

    const isOwner = row.requester_id === req.user.id;
    const isDeptStaff = req.user.department_id === row.target_department_id;
    const isAdmin = req.user.role === 'Admin';
    if (!isOwner && !isDeptStaff && !isAdmin) {
      return res.status(403).json({ error: 'You do not have access to this file.' });
    }

    const filePath = path.join(__dirname, '..', row.completed_attachment_url);
    return res.download(filePath);
  } catch (err) {
    console.error('downloadDeliverable error:', err);
    return res.status(500).json({ error: 'Failed to download deliverable.' });
  }
}

async function cancelRequest(req, res) {
  try {
    const updated = await requestModel.cancel(req.params.id, req.user.id);
    if (!updated) {
      return res.status(409).json({ error: 'Only your own PENDING requests can be cancelled.' });
    }
    return res.json({ request: withBadge(updated) });
  } catch (err) {
    console.error('cancelRequest error:', err);
    return res.status(500).json({ error: 'Failed to cancel request.' });
  }
}

/** Service Lead: [ Decline ] — rejects a PENDING request before claiming it. */
async function declineRequest(req, res) {
  try {
    const updated = await requestModel.decline(req.params.id, req.user.id);
    if (!updated) {
      return res.status(409).json({ error: 'Only PENDING requests can be declined.' });
    }

    const requester = await userModel.findById(updated.requester_id);
    if (requester) {
      statusChangeEmail({
        to: requester.email,
        requesterName: requester.full_name,
        requestTitle: updated.title,
        requestId: updated.id,
        newStatus: 'DECLINED',
      });
    }

    return res.json({ request: withBadge(updated) });
  } catch (err) {
    console.error('declineRequest error:', err);
    return res.status(500).json({ error: 'Failed to decline request.' });
  }
}

/** Admin: permanently deletes a finished request (COMPLETED, CANCELLED, or DECLINED only). */
async function deleteRequest(req, res) {
  try {
    const row = await requestModel.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Request not found.' });
    if (!['COMPLETED', 'CANCELLED', 'DECLINED'].includes(row.status)) {
      return res.status(409).json({ error: 'Only completed, cancelled, or declined requests can be deleted.' });
    }
    await requestModel.remove(row.id);
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteRequest error:', err);
    return res.status(500).json({ error: 'Failed to delete request.' });
  }
}

module.exports = {
  createRequest,
  myRequests,
  departmentQueue,
  getRequest,
  startWorking,
  completeAndDeliver,
  downloadDeliverable,
  cancelRequest,
  declineRequest,
  deleteRequest,
};
