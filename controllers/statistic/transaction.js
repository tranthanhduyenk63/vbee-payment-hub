const moment = require('moment');
const CustomError = require('../../errors/CustomError');
const { ERROR_CODE } = require('../../errors/code');
const { getUsdToVndRate } = require('../../services/currencyExchangeRate');
const statsService = require('../../services/statistic/transaction');
const logger = require('../../utils/logger');
const { getResponseNoCors } = require('../../utils/function');

const getRevenue = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const query = payload.queryStringParameters;
  logger.info({ query }, { ctx: 'getRevenue' });

  const { startDate, endDate, providerName, type, partnerName, channelName } =
    query;
  const usdToVndRate = await getUsdToVndRate();

  const totalRevenue = await statsService.countRevenue(
    { startDate, endDate, providerName, type, partnerName, channelName },
    usdToVndRate,
  );

  return getResponseNoCors({
    error: 0,
    totalRevenue,
  });
};

const statsRevenues = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const { startDate, endDate } = payload.queryStringParameters;
  logger.info({ startDate, endDate }, { ctx: 'statsRevenues' });

  const usdToVndRate = await getUsdToVndRate();
  const query = { startDate, endDate, usdToVndRate };
  const statsResult = await Promise.all([
    statsService.statsRevenueByPartner(query),
    statsService.statsRevenueByProvider(query),
    statsService.statsRevenueByChannel(query),
    statsService.statsRevenueByState(query),
  ]);

  const [
    revenueByPartner,
    revenueByProvider,
    revenueByChannel,
    revenueByState,
  ] = statsResult;

  return getResponseNoCors({
    error: 0,
    revenueByPartner,
    revenueByProvider,
    revenueByChannel,
    revenueByState,
  });
};

const statsRevenuesByDate = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const { startDate, endDate } = payload.queryStringParameters;
  logger.info({ startDate, endDate }, { ctx: 'statsRevenuesByDate' });

  const usdToVndRate = await getUsdToVndRate();
  const query = { startDate, endDate, usdToVndRate };
  const statsResult = await Promise.all([
    statsService.statsRevenueByPartnerByDate(query),
    statsService.statsRevenueByProviderByDate(query),
    statsService.statsRevenueByChannelByDate(query),
  ]);

  const [
    revenueByPartnerByDate,
    revenueByProviderByDate,
    revenueByChannelByDate,
  ] = statsResult;

  return getResponseNoCors({
    error: 0,
    revenueByProviderByDate,
    revenueByChannelByDate,
    revenueByPartnerByDate,
  });
};

const notifyPartnerRevenueDaily = async (event, context, callback) => {
  const date = moment().utcOffset(7).subtract(1, 'day').format('YYYY-MM-DD');
  logger.info(date, { ctx: 'NotifyRevenueDaily' });
  await statsService.notifyPartnerRevenue(date);
};

module.exports = {
  getRevenue,
  statsRevenues,
  statsRevenuesByDate,
  notifyPartnerRevenueDaily,
};
