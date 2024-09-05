const uuid = require('uuid');

const s3Client = require('./client');
const logger = require('../../utils/logger');
const { BUCKET_NAME } = require('../../configs');

const EXPIRES_IN_DEFAULT = 3 * 60;

const createPresignedUrlForSharing = async ({
  bucket = BUCKET_NAME,
  key = uuid.v4(),
  expiresIn = EXPIRES_IN_DEFAULT,
} = {}) => {
  try {
    // Create the presigned URL.
    const signedUrl = await s3Client.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key, // filename
      Expires: expiresIn,
    });
    return signedUrl;
  } catch (err) {
    logger.info(`Error creating presigned URL ${JSON.stringify(err)}`, {
      ctx: 'presignedUrlForSharing',
    });
    throw err;
  }
};

module.exports = {
  createPresignedUrlForSharing,
};
