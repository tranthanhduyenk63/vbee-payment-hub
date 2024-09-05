const RevenueReport = require('../model/revenueReport');

const { getDateQuery, getSortQuery } = require('./utils/util');
const logger = require('../utils/logger');

const findRevenueReports = async (query) => {
  const { startDate, endDate, providerName, sort, ...dataQuery } = query;
  const pipeline = [
    {
      $lookup: {
        from: 'providers',
        localField: 'provider',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $unwind: { path: '$provider' } },
    {
      $lookup: {
        from: 'channels',
        localField: 'channel',
        foreignField: '_id',
        as: 'channel',
      },
    },
    { $unwind: { path: '$channel' } },
    {
      $lookup: {
        from: 'feetypes',
        localField: 'feeType',
        foreignField: '_id',
        as: 'feeType',
      },
    },
    { $unwind: { path: '$feeType' } },
  ];

  let matchQuery = {};
  if (providerName) matchQuery['provider.name'] = providerName;
  if (startDate || endDate) {
    matchQuery = { ...matchQuery, ...getDateQuery('time', startDate, endDate) };
  }
  pipeline.push({ $match: { ...matchQuery, ...dataQuery } });

  if (sort) pipeline.push({ $sort: { ...getSortQuery(sort) } });

  logger.info(JSON.stringify(pipeline), { ctx: 'FindRevenueReports' });
  const revenueReports = await RevenueReport.aggregate(pipeline);
  return revenueReports;
};

module.exports = { findRevenueReports };
