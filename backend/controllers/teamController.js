import Team from '../models/Team.js';
import User from '../models/User.js';
import OrganizationMember from '../models/OrganizationMember.js';

export const createTeam = async (req, res) => {
  try {
    const { name, organizationId, members } = req.body;

    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const adminMembership = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId,
      role: 'OrgAdmin',
    }).select('_id');

    if (!adminMembership) {
      return res.status(403).json({ message: 'Only organization admins can create teams' });
    }

    const orgMembers = await OrganizationMember.find({ organizationId }).select('userId');
    const orgMemberIds = new Set(orgMembers.map((member) => member.userId.toString()));
    const requestedMembers = Array.isArray(members) ? members : [];
    const invalidMembers = requestedMembers.filter((memberId) => !orgMemberIds.has(memberId.toString()));

    if (invalidMembers.length > 0) {
      return res.status(400).json({ message: 'All team members must belong to the organization' });
    }

    const team = new Team({
      name,
      organizationId,
      owner: req.user._id,
      members: requestedMembers.length > 0 ? requestedMembers : [req.user._id]
    });
    
    // Ensure owner is in members array
    if (!team.members.some(m => m.toString() === req.user._id.toString())) {
      team.members.push(req.user._id);
    }
    
    await team.save();
    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTeams = async (req, res) => {
  try {
    const { organizationId } = req.query;

    const query = {};
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const membership = organizationId
      ? await OrganizationMember.findOne({
          userId: req.user._id,
          organizationId,
        }).select('role')
      : null;

    if (!membership || membership.role !== 'OrgAdmin') {
      query.members = req.user._id;
    }

    const teams = await Team.find(query)
      .populate('owner', 'name email')
      .populate('members', 'name email avatar');
      
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email avatar');
      
    if (!team) return res.status(404).json({ message: 'Team not found' });
    
    // Verify membership
    if (!team.members.some(m => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this team' });
    }
    
    res.json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTeam = async (req, res) => {
  try {
    const { name, members, owner } = req.body;
    const team = await Team.findById(req.params.id);
    
    if (!team) return res.status(404).json({ message: 'Team not found' });
    const adminMembership = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId: team.organizationId,
      role: 'OrgAdmin',
    }).select('_id');

    const isOwner = team.owner.toString() === req.user._id.toString();

    if (!isOwner && !adminMembership) {
      return res.status(403).json({ message: 'Only team owner or organization admin can update' });
    }

    const orgMembers = await OrganizationMember.find({ organizationId: team.organizationId }).select('userId');
    const orgMemberIds = new Set(orgMembers.map((member) => member.userId.toString()));
    
    if (name) team.name = name;
    if (members) {
      const invalidMembers = members.filter((memberId) => !orgMemberIds.has(memberId.toString()));

      if (invalidMembers.length > 0) {
        return res.status(400).json({ message: 'All team members must belong to the organization' });
      }

      team.members = members;
      if (!team.members.some(m => m.toString() === team.owner.toString())) {
        team.members.push(team.owner);
      }
    }

    if (owner !== undefined) {
      if (!adminMembership) {
        return res.status(403).json({ message: 'Only organization admins can change team ownership' });
      }
      if (owner && !orgMemberIds.has(owner.toString())) {
        return res.status(400).json({ message: 'Team owner must be a member of the organization' });
      }

      team.owner = owner || team.owner;
      if (!team.members.some((member) => member.toString() === team.owner.toString())) {
        team.members.push(team.owner);
      }
    }
    
    await team.save();
    const updatedTeam = await Team.findById(team._id)
      .populate('owner', 'name email avatar')
      .populate('members', 'name email avatar');
    res.json(updatedTeam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    const adminMembership = await OrganizationMember.findOne({
      userId: req.user._id,
      organizationId: team.organizationId,
      role: 'OrgAdmin',
    }).select('_id');

    if (team.owner.toString() !== req.user._id.toString() && !adminMembership) {
      return res.status(403).json({ message: 'Only team owner or organization admin can delete' });
    }
    
    await team.deleteOne();
    res.json({ message: 'Team removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
