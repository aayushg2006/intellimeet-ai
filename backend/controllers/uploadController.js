import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Meeting from '../models/Meeting.js';
import s3Service from '../services/s3Service.js';

/**
 * @route   POST /api/uploads/avatar
 * @desc    Upload user profile avatar
 */
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old avatar from S3 if it exists and is an S3 key (not a Google/external URL)
    if (user.avatar && !user.avatar.startsWith('http')) {
      try { await s3Service.deleteFile(user.avatar); } catch (e) { /* ignore */ }
    }

    // Upload new avatar
    const key = s3Service.generateKey('avatars', req.user._id.toString(), req.file.originalname);
    await s3Service.uploadFile(req.file.buffer, key, req.file.mimetype);

    // Store the S3 key in the user model
    user.avatar = key;
    await user.save();

    // Return a pre-signed URL for immediate display
    const url = await s3Service.getSignedUrl(key);

    res.json({ key, url, message: 'Avatar uploaded successfully' });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route   POST /api/uploads/org-logo
 * @desc    Upload organization logo
 */
export const uploadOrgLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required' });
    }

    const org = await Organization.findById(organizationId);
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Delete old logo if exists
    if (org.logo && !org.logo.startsWith('http')) {
      try { await s3Service.deleteFile(org.logo); } catch (e) { /* ignore */ }
    }

    const key = s3Service.generateKey('logos', organizationId, req.file.originalname);
    await s3Service.uploadFile(req.file.buffer, key, req.file.mimetype);

    org.logo = key;
    await org.save();

    const url = await s3Service.getSignedUrl(key);

    res.json({ key, url, message: 'Logo uploaded successfully' });
  } catch (error) {
    console.error('Org logo upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route   POST /api/uploads/meeting-file
 * @desc    Upload a file attachment to a meeting
 */
export const uploadMeetingFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const { meetingId } = req.body;
    if (!meetingId) {
      return res.status(400).json({ message: 'meetingId is required' });
    }

    // Find meeting by roomId or _id
    let meeting = await Meeting.findOne({ roomId: meetingId });
    if (!meeting && meetingId.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(meetingId);
    }
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const key = s3Service.generateKey('meetings', meetingId, req.file.originalname);
    await s3Service.uploadFile(req.file.buffer, key, req.file.mimetype);

    const attachment = {
      fileName: req.file.originalname,
      s3Key: key,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    };

    meeting.attachments.push(attachment);
    await meeting.save();

    const url = await s3Service.getSignedUrl(key);

    res.json({
      ...attachment,
      url,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Meeting file upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route   POST /api/uploads/recording
 * @desc    Upload a meeting recording
 */
export const uploadRecording = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No recording file provided' });
    }

    const { meetingId } = req.body;
    if (!meetingId) {
      return res.status(400).json({ message: 'meetingId is required' });
    }

    let meeting = await Meeting.findOne({ roomId: meetingId });
    if (!meeting && meetingId.match(/^[0-9a-fA-F]{24}$/)) {
      meeting = await Meeting.findById(meetingId);
    }
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Delete old recording if exists
    if (meeting.recordingKey) {
      try { await s3Service.deleteFile(meeting.recordingKey); } catch (e) { /* ignore */ }
    }

    const key = s3Service.generateKey('recordings', meetingId, req.file.originalname);
    await s3Service.uploadFile(req.file.buffer, key, req.file.mimetype);

    meeting.recordingKey = key;
    await meeting.save();

    const url = await s3Service.getSignedUrl(key);

    res.json({ key, url, message: 'Recording uploaded successfully' });
  } catch (error) {
    console.error('Recording upload error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route   GET /api/uploads/signed-url
 * @desc    Get a fresh pre-signed URL for any S3 key
 */
export const getFileUrl = async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ message: 'key query parameter is required' });
    }

    const url = await s3Service.getSignedUrl(key);
    res.json({ url });
  } catch (error) {
    console.error('Signed URL error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route   DELETE /api/uploads
 * @desc    Delete a file from S3 (by key in query)
 */
export const deleteUpload = async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ message: 'key query parameter is required' });
    }

    await s3Service.deleteFile(key);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: error.message });
  }
};
