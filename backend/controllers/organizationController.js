import Organization from '../models/Organization.js';
import OrganizationMember from '../models/OrganizationMember.js';
import crypto from 'crypto';

/**
 * @route   POST /api/organizations
 * @desc    Create a new organization
 */
export const createOrganization = async (req, res, next) => {
  try {
    const { name, domain } = req.body;

    const organization = await Organization.create({
      name,
      domain: domain ? domain.toLowerCase() : undefined,
      customUrlToken: crypto.randomBytes(16).toString('hex'),
    });

    // Make the creator an OrgAdmin
    await OrganizationMember.create({
      userId: req.user._id,
      organizationId: organization._id,
      role: 'OrgAdmin',
    });

    res.status(201).json(organization);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/organizations
 * @desc    Get all organizations the user is a member of
 */
export const getUserOrganizations = async (req, res, next) => {
  try {
    const memberships = await OrganizationMember.find({ userId: req.user._id }).populate('organizationId');
    const organizations = memberships.map((m) => ({
      ...m.organizationId.toObject(),
      userRole: m.role,
    }));
    res.json(organizations);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/organizations/:id
 * @desc    Get organization details (must be a member)
 */
export const getOrganizationById = async (req, res, next) => {
  try {
    const membership = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId: req.params.id,
    });

    if (!membership) {
      res.status(403);
      throw new Error('Not authorized to view this organization');
    }

    const organization = await Organization.findById(req.params.id);
    res.json(organization);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/organizations/join/:token
 * @desc    Join an organization via a custom URL token
 */
export const joinOrganization = async (req, res, next) => {
  try {
    const { token } = req.params;

    const organization = await Organization.findOne({ customUrlToken: token });
    if (!organization) {
      res.status(404);
      throw new Error('Invalid invite link');
    }

    const existingMember = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId: organization._id,
    });

    if (existingMember) {
      return res.json({ message: 'Already a member', organizationId: organization._id });
    }

    await OrganizationMember.create({
      userId: req.user._id,
      organizationId: organization._id,
      role: 'OrgMember',
    });

    res.status(201).json({ message: 'Successfully joined organization', organizationId: organization._id });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/organizations/:id/members
 * @desc    Get all members of an organization
 */
export const getMembers = async (req, res, next) => {
  try {
    const membership = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId: req.params.id,
    });

    if (!membership) {
      res.status(403);
      throw new Error('Not authorized to view this organization');
    }

    const members = await OrganizationMember.find({ organizationId: req.params.id })
      .populate('userId', 'name email avatar');
    
    res.json(members);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/organizations/:id/members/:memberId/role
 * @desc    Update a member's role (OrgAdmin only)
 */
export const updateMemberRole = async (req, res, next) => {
  try {
    const adminMembership = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId: req.params.id,
      role: 'OrgAdmin'
    });

    if (!adminMembership) {
      res.status(403);
      throw new Error('Only organization admins can perform this action');
    }

    const { role } = req.body;
    
    if (!['OrgAdmin', 'OrgMember'].includes(role)) {
      res.status(400);
      throw new Error('Invalid role');
    }

    const targetMembership = await OrganizationMember.findOne({
      userId: req.params.memberId,
      organizationId: req.params.id,
    });

    if (!targetMembership) {
      res.status(404);
      throw new Error('Member not found');
    }

    // Prevent removing the last admin
    if (targetMembership.role === 'OrgAdmin' && role === 'OrgMember') {
      const adminCount = await OrganizationMember.countDocuments({
        organizationId: req.params.id,
        role: 'OrgAdmin'
      });
      if (adminCount <= 1) {
        res.status(400);
        throw new Error('Cannot demote the last organization admin');
      }
    }

    targetMembership.role = role;
    await targetMembership.save();

    res.json({ message: 'Role updated successfully', member: targetMembership });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/organizations/:id/members/:memberId
 * @desc    Remove a member from the organization (OrgAdmin only)
 */
export const removeMember = async (req, res, next) => {
  try {
    const adminMembership = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId: req.params.id,
      role: 'OrgAdmin'
    });

    if (!adminMembership) {
      res.status(403);
      throw new Error('Only organization admins can perform this action');
    }

    const targetMembership = await OrganizationMember.findOne({
      userId: req.params.memberId,
      organizationId: req.params.id,
    });

    if (!targetMembership) {
      res.status(404);
      throw new Error('Member not found');
    }

    if (targetMembership.role === 'OrgAdmin') {
      const adminCount = await OrganizationMember.countDocuments({
        organizationId: req.params.id,
        role: 'OrgAdmin'
      });
      if (adminCount <= 1) {
        res.status(400);
        throw new Error('Cannot remove the last organization admin');
      }
    }

    await OrganizationMember.deleteOne({ _id: targetMembership._id });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};
