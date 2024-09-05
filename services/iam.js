const snakeCaseKeys = require('snakecase-keys');
const callApi = require('../utils/callApi');
const {
  IAM_URL,
  IAM_REALM,
  IAM_CLIENT_ID,
  IAM_CLIENT_SECRET,
} = require('../configs');
const logger = require('../utils/logger');
const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');

let iamPublicKey = null;

const getPublicKey = async () => {
  if (!iamPublicKey) {
    const { publicKey } = await callApi({
      method: 'GET',
      url: `${IAM_URL}/auth/realms/${IAM_REALM}`,
    });

    iamPublicKey = `-----BEGIN PUBLIC KEY-----\r\n${publicKey}\r\n-----END PUBLIC KEY-----`;
    logger.info(`get IAM public key Success: \n${publicKey}\n`, {
      ctx: 'PublicKey',
    });
    return iamPublicKey;
  }
  logger.info('Reuse IAM public key', {
    ctx: 'PublicKey',
  });
  return iamPublicKey;
};

const getAccessToken = async () => {
  const data = {
    clientId: IAM_CLIENT_ID,
    clientSecret: IAM_CLIENT_SECRET,
    grantType: 'client_credentials',
  };

  try {
    const { accessToken } = await callApi({
      method: 'POST',
      url: `${IAM_URL}/auth/realms/${IAM_REALM}/protocol/openid-connect/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams(snakeCaseKeys(data)),
    });

    return accessToken;
  } catch (error) {
    throw new CustomError(ERROR_CODE.IAM_ERROR);
  }
};

module.exports = { getPublicKey, getAccessToken };
