import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';

// ─── S3 CLIENT ───
let s3ClientInstance = null;

const getS3Client = () => {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
};

const getBucketName = () => process.env.AWS_S3_BUCKET_NAME;

/**
 * Generate a unique S3 key for a file.
 * Example: "avatars/userId123/1672000000-abc12345.jpg"
 */
export const generateKey = (folder, ownerId, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return `${folder}/${ownerId}/${timestamp}-${uniqueId}${ext}`;
};

/**
 * Upload a file buffer to S3.
 * @param {Buffer} fileBuffer - The file data
 * @param {String} key - The S3 object key
 * @param {String} contentType - MIME type
 * @returns {Object} { key, bucket }
 */
export const uploadFile = async (fileBuffer, key, contentType) => {
  const bucket = getBucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await getS3Client().send(command);

  return { key, bucket };
};

/**
 * Get a temporary pre-signed URL for downloading/viewing a file.
 * @param {String} key - The S3 object key
 * @param {Number} expiresIn - Seconds until URL expires (default: 1 hour)
 * @returns {String} Pre-signed URL
 */
export const getSignedUrl = async (key, expiresIn = 3600) => {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  return await s3GetSignedUrl(getS3Client(), command, { expiresIn });
};

/**
 * Delete a file from S3.
 * @param {String} key - The S3 object key
 */
export const deleteFile = async (key) => {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await getS3Client().send(command);
};

export default {
  uploadFile,
  getSignedUrl,
  deleteFile,
  generateKey,
};
