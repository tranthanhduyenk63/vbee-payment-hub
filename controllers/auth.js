const authService = require('../services/auth');
const providerService = require('../services/provider');
const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');

const authIAMClient = async (payload, role) => {
  const { Authorization } = payload.headers;
  if (!Authorization) throw new CustomError(ERROR_CODE.UNAUTHORIZED);

  const { clientId } = await authService.authIAMClient(Authorization, role);

  // Convert clientId to providerName
  const provider = await providerService.getProviderByClientId(clientId);
  payload.providerName = provider ? provider.name : clientId;

  payload.clientId = clientId;
};

const authUser = async (payload, role) => {
  const { Authorization } = payload.headers;
  if (!Authorization) throw new CustomError(ERROR_CODE.UNAUTHORIZED);

  const user = await authService.verifyUserToken(Authorization, role);

  payload.userInfo = user;
};

module.exports = { authIAMClient, authUser };
