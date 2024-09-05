const jwt = require('jsonwebtoken');
const camelcaseKeys = require('camelcase-keys');
const { IAM_CLIENT_ID } = require('../configs');
const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');
const { getPublicKey } = require('./iam');
const logger = require('../utils/logger');

const authIAMClient = async (accessToken, role) => {
  const publicKey = await getPublicKey();
  try {
    let data = jwt.verify(accessToken, publicKey);
    data = camelcaseKeys(data);
    const { clientId, resourceAccess } = data;

    if (role) {
      const roles = resourceAccess[IAM_CLIENT_ID]?.roles || [];
      if (!roles.includes(role)) throw new CustomError(ERROR_CODE.UNAUTHORIZED);
    }

    return { clientId };
  } catch (error) {
    logger.info('verify iam token error', {
      stack: error,
      ctx: 'Auth IAM client',
    });
    throw new CustomError(ERROR_CODE.UNAUTHORIZED);
  }
};

const verifyUserToken = async (accessToken, role) => {
  const publicKey = await getPublicKey();
  try {
    let data = jwt.verify(accessToken, publicKey);
    data = camelcaseKeys(data);
    const {
      sub: userId,
      name,
      email,
      phoneNumber,
      identityProvider,
      preferredUsername,
      resourceAccess,
    } = data;

    if (role) {
      const roles = resourceAccess[IAM_CLIENT_ID]?.roles || [];
      if (!roles.includes(role)) throw new CustomError(ERROR_CODE.UNAUTHORIZED);
    }

    return {
      userId,
      name,
      email,
      phoneNumber,
      identityProvider,
      preferredUsername,
    };
  } catch (error) {
    logger.info('verify iam token error', {
      stack: error,
      ctx: 'Auth User',
    });
    throw new CustomError(ERROR_CODE.UNAUTHORIZED);
  }
};

module.exports = {
  authIAMClient,
  verifyUserToken,
};
