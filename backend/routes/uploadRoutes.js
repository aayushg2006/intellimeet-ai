import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { uploadImage, uploadAttachment, uploadRecording as uploadRecordingMiddleware, handleMulterError } from '../middleware/upload.js';
import {
  uploadAvatar,
  uploadOrgLogo,
  uploadMeetingFile,
  uploadRecording,
  getFileUrl,
  deleteUpload,
} from '../controllers/uploadController.js';

const router = express.Router();

// Avatar upload (images only, 5MB max)
router.post('/avatar', protect, (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, uploadAvatar);

// Organization logo upload (images only, 5MB max)
router.post('/org-logo', protect, (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, uploadOrgLogo);

// Meeting file attachment (images + docs, 25MB max)
router.post('/meeting-file', protect, (req, res, next) => {
  uploadAttachment(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, uploadMeetingFile);

// Meeting recording (video/audio, 500MB max)
router.post('/recording', protect, (req, res, next) => {
  uploadRecordingMiddleware(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, uploadRecording);

// Get a fresh pre-signed URL for any S3 key
router.get('/signed-url', protect, getFileUrl);

// Delete a file from S3
router.delete('/', protect, deleteUpload);

export default router;
