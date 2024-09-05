const logger = require('@vbee-holding/node-logger');
const { PRODUCT, NODE_ENV } = require('../configs');

const childLogger = logger.child({
  time: new Date().toISOString(),
  env: NODE_ENV,
  product: PRODUCT,
});

module.exports = childLogger;
