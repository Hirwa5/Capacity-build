/**
 * routes/requestRoutes.js
 */
const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const commentController = require('../controllers/commentController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { uploadBrief, uploadDeliverable } = require('../middleware/uploadMiddleware');

// Also mount categories/departments read-only lookups for the request form
const departmentModel = require('../models/departmentModel');
const categoryModel = require('../models/categoryModel');

// Public: department list is needed on the registration screen before login.
router.get('/lookups/departments', async (req, res) => {
  const departments = await departmentModel.findAll();
  res.json({ departments });
});
router.get('/lookups/categories', requireAuth, async (req, res) => {
  const departmentId = req.query.departmentId;
  const categories = departmentId
    ? await categoryModel.findByDepartment(departmentId)
    : await categoryModel.findAll();
  res.json({ categories });
});

// Requester: create + view own requests
router.post('/', requireAuth, requireRole('Requester'), uploadBrief.single('attachment'), requestController.createRequest);
router.get('/mine', requireAuth, requireRole('Requester'), requestController.myRequests);
router.post('/:id/cancel', requireAuth, requireRole('Requester'), requestController.cancelRequest);
router.delete('/:id', requireAuth, requireRole('Requester'), requestController.deleteRequest);
// Service Lead: sorted incoming queue, claim, deliver
router.get('/queue', requireAuth, requireRole('Assignee', 'Admin'), requestController.departmentQueue);
router.post('/:id/start', requireAuth, requireRole('Assignee', 'Admin'), requestController.startWorking);
router.post(
  '/:id/deliver',
  requireAuth,
  requireRole('Assignee', 'Admin'),
  uploadDeliverable.single('deliverable'),
  requestController.completeAndDeliver
);

// Shared: get single request, download deliverable
router.get('/:id', requireAuth, requestController.getRequest);
router.get('/:id/download', requireAuth, requestController.downloadDeliverable);

// Comments: two-way discussion inside the task card
router.get('/:id/comments', requireAuth, commentController.listComments);
router.post('/:id/comments', requireAuth, uploadBrief.single('attachment'), commentController.postComment);

module.exports = router;
