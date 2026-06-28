import multer from 'multer';

// ─── ALLOWED MIME TYPES ───
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
const RECORDING_TYPES = ['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4'];

const ALL_ALLOWED = [...IMAGE_TYPES, ...DOCUMENT_TYPES, ...RECORDING_TYPES];

// ─── MULTER CONFIG ───
// Memory storage — files stay in RAM buffer, then we stream to S3.
const storage = multer.memoryStorage();

/**
 * Creates a multer upload instance with file type and size validation.
 * @param {Object} options
 * @param {String[]} options.allowedTypes - Array of allowed MIME types
 * @param {Number} options.maxSize - Max file size in bytes
 */
const createUpload = ({ allowedTypes = ALL_ALLOWED, maxSize = 25 * 1024 * 1024 } = {}) => {
  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      const baseMimeType = file.mimetype.split(';')[0].trim();
      if (allowedTypes.includes(baseMimeType)) {
        cb(null, true);
      } else {
        cb(new Error(`File type '${file.mimetype}' is not allowed. Allowed: ${allowedTypes.join(', ')}`), false);
      }
    },
  });
};

// ─── PRE-BUILT UPLOAD INSTANCES ───

/** Avatar/logo upload: images only, max 5MB */
export const uploadImage = createUpload({
  allowedTypes: IMAGE_TYPES,
  maxSize: 5 * 1024 * 1024,
}).single('file');

/** Meeting attachment: images + documents, max 25MB */
export const uploadAttachment = createUpload({
  allowedTypes: [...IMAGE_TYPES, ...DOCUMENT_TYPES],
  maxSize: 25 * 1024 * 1024,
}).single('file');

/** Meeting recording: video/audio, max 500MB */
export const uploadRecording = createUpload({
  allowedTypes: RECORDING_TYPES,
  maxSize: 500 * 1024 * 1024,
}).single('file');

/**
 * Express error-handling wrapper for multer.
 * Catches multer-specific errors (file too large, wrong type) and returns a clean JSON response.
 */
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File is too large. Please upload a smaller file.' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};
