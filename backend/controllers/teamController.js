import Team from '../models/Team.js';
import User from '../models/User.js';

export const createTeam = async (req, res) => {
  try {
    const { name, organizationId, members } = req.body;
    const team = new Team({
      name,
      organizationId,
      owner: req.user._id,
      members: members || [req.user._id]
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
    
    const query = { members: req.user._id };
    if (organizationId) {
      query.organizationId = organizationId;
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
    const { name, members } = req.body;
    const team = await Team.findById(req.params.id);
    
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only team owner can update' });
    }
    
    if (name) team.name = name;
    if (members) {
      team.members = members;
      if (!team.members.some(m => m.toString() === team.owner.toString())) {
        team.members.push(team.owner);
      }
    }
    
    await team.save();
    res.json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only team owner can delete' });
    }
    
    await team.deleteOne();
    res.json({ message: 'Team removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
