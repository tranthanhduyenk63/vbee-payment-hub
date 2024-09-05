const moment = require('moment');
const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');
const recheckRevenueService = require('../services/recheckRevenue');
const { getResponseNoCors } = require('../utils/function');

const getRecheckRevenue = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }
  const { startDate, endDate } = payload.queryStringParameters;
  const res = await recheckRevenueService.getRecheckRevenue({
    startDate,
    endDate,
  });

  return getResponseNoCors({
    error: 0,
    data: res,
  });
};

const recheckRevenueDaily = async (event, context, callback) => {
  const startDate = moment().subtract(1, 'days').startOf('day').toISOString();
  const endDate = moment().subtract(1, 'days').endOf('day').toISOString();
  await recheckRevenueService.recheckRevenue({ startDate, endDate });
};

const recheckRevenueMonthly = async (event, context, callback) => {
  const startDate = moment()
    .subtract(1, 'months')
    .startOf('month')
    .toISOString();
  const endDate = moment().subtract(1, 'months').endOf('month').toISOString();
  await recheckRevenueService.recheckRevenue({ startDate, endDate });
};

module.exports = {
  getRecheckRevenue,
  recheckRevenueDaily,
  recheckRevenueMonthly,
};
