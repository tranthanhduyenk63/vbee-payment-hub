const CustomError = require('../../errors/CustomError');
const { ERROR_CODE } = require('../../errors/code');
const { getUsdToVndRate } = require('../../services/currencyExchangeRate');
const statsReconcileService = require('../../services/statistic/reconcileOrder');
const logger = require('../../utils/logger');
const { getResponseNoCors } = require('../../utils/function');

const statsRevenues = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const { startDate, endDate, type } = payload.queryStringParameters;
  if (!type) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Type is required');
  }
  logger.info({ startDate, endDate, type }, { ctx: 'statsRevenues' });

  const usdToVndRate = await getUsdToVndRate();
  const query = { startDate, endDate, type, usdToVndRate };
  const statsResult = await Promise.all([
    statsReconcileService.statsRevenueByProvider(query),
    statsReconcileService.statsRevenueByChannel(query),
    statsReconcileService.statsRevenueByFeeType(query),
  ]);

  const [revenueByProvider, revenueByChannel, revenueByFeeType] = statsResult;

  return getResponseNoCors({
    error: 0,
    revenueByProvider,
    revenueByChannel,
    revenueByFeeType,
  });
};

const statsRevenuesByChannelByDate = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const { startDate, endDate, type, providerName, feeType, ...query } =
    payload.queryStringParameters;

  logger.info(
    { startDate, endDate, type, providerName, feeType, ...query },
    { ctx: 'statsRevenuesByChannelByDate' },
  );

  if (!type) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Type is required');
  }

  const statsResult = await statsReconcileService.statsRevenueByChannelByDate({
    startDate,
    endDate,
    type,
    providerName,
    feeType,
    query,
  });

  return getResponseNoCors({
    error: 0,
    revenueByChannel: statsResult,
  });
};

module.exports = {
  statsRevenues,
  statsRevenuesByChannelByDate,
};
