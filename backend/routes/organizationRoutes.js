import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createOrganization,
  getUserOrganizations,
  getOrganizationById,
  joinOrganization
} from '../controllers/organizationController.js';

const router = express.Router();

router.route('/')
  .post(protect, createOrganization)
  .get(protect, getUserOrganizations);

router.route('/:id')
  .get(protect, getOrganizationById);

router.route('/join/:token')
  .post(protect, joinOrganization);

export default router;
