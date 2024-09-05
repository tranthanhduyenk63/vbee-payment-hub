const mongoose = require('mongoose');
const { MONGO_URI } = require('../configs');
const logger = require('../utils/logger');

exports.connectToDatabase = async () => {
  const conn = mongoose
    .connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      logger.info(`Connected to MongoDB: ${MONGO_URI}`, { ctx: 'MongoDB' });
      return mongoose;
    })
    .catch((err) => {
      logger.error(`Connect error to MongoDB: ${MONGO_URI}`, {
        ctx: 'MongoDB',
        stack: err.stack,
      });
      process.exit(1);
    });

  await conn;
  return conn;
};
