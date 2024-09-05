const AWS = require('aws-sdk');
const { S3_ID_LIB, S3_KEY_LIB } = require('../../configs');

// Create an Amazon S3 service client object.
const credentials = {
  accessKeyId: S3_ID_LIB,
  secretAccessKey: S3_KEY_LIB,
};
AWS.config.update({ credentials });

const s3Client = new AWS.S3();

module.exports = s3Client;
