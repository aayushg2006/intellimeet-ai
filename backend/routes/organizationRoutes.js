import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createOrganization,
  getUserOrganizations,
  getOrganizationById,
  joinOrganization,
  getMembers,
  updateMemberRole,
  removeMember
} from '../controllers/organizationController.js';

const router = express.Router();

router.route('/')
  .post(protect, createOrganization)
  .get(protect, getUserOrganizations);

router.route('/:id')
  .get(protect, getOrganizationById);

router.route('/join/:token')
  .post(protect, joinOrganization);

router.route('/:id/members')
  .get(protect, getMembers);

router.route('/:id/members/:memberId/role')
  .put(protect, updateMemberRole);

router.route('/:id/members/:memberId')
  .delete(protect, removeMember);

export default router;
