const moment = require('moment');
const revenueStatsService = require('../services/revenueStats');
const logger = require('../utils/logger');

const notifyRevenueDaily = async (event, context, callback) => {
  const date = moment().utcOffset(7).subtract(1, 'day').format('YYYY-MM-DD');
  logger.info(date, { ctx: 'NotifyRevenueDaily' });
  await revenueStatsService.notifySmeRevenue(date);
};

const notifyProviderRevenueDaily = async (event, context, callback) => {
  const date = moment().utcOffset(7).subtract(1, 'day').format('YYYY-MM-DD');
  logger.info(date, { ctx: 'NotifyProviderRevenueDaily' });
  await revenueStatsService.notifyProviderRevenue(date);
};

const notifySubRevenueDaily = async (event, context, callback) => {
  const date = moment().utcOffset(7).subtract(1, 'day').format('YYYY-MM-DD');
  logger.info(date, { ctx: 'NotifySubRevenueDaily' });
  await revenueStatsService.notifySubscriptionRevenue(date);
};

const notifyTotalRevenueDaily = async (event, context, callback) => {
  const date = moment().utcOffset(7).subtract(1, 'day').format('YYYY-MM-DD');
  logger.info(date, { ctx: 'NotifyRevenueDaily' });
  await revenueStatsService.notifyTotalRevenue(date);
};

const exportRevenueReports = async (event, context, callback) => {
  const date = moment().utcOffset(7).subtract(1, 'day').format('YYYY-MM-DD');
  logger.info(date, { ctx: 'ExportRevenueReports' });
  await revenueStatsService.exportRevenueReports(date);
};

module.exports = {
  notifyRevenueDaily,
  notifyProviderRevenueDaily,
  notifyTotalRevenueDaily,
  notifySubRevenueDaily,
  exportRevenueReports,
};
