const moment = require('moment');
const { REPORT_TYPE } = require('../constants');
const UserReport = require('../model/userReport');
const logger = require('../utils/logger');
const { getDateQuery, getSortQuery } = require('./utils');

const findUserReports = async (query) => {
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
  ];

  let matchQuery = {};
  if (providerName) matchQuery['provider.name'] = providerName;
  if (startDate || endDate) {
    matchQuery = { ...matchQuery, ...getDateQuery('time', startDate, endDate) };
  }
  pipeline.push({ $match: { ...matchQuery, ...dataQuery } });

  if (sort) pipeline.push({ $sort: { ...getSortQuery(sort) } });

  logger.info(JSON.stringify(pipeline), { ctx: 'FindUserReports' });
  const userReports = await UserReport.aggregate(pipeline);
  return userReports;
};

const statsUserByProvider = async ({ startDate, endDate }) => {
  const userStats = await UserReport.aggregate([
    {
      $match: {
        type: REPORT_TYPE.DAY,
        time: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
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
      $group: {
        _id: '$provider.name',
        totalNewUsers: { $sum: '$totalNewUsers' },
        totalSwitchUsers: { $sum: '$totalSwitchUsers' },
      },
    },
  ]);

  const result = {};
  userStats.forEach((stat) => {
    const { _id: providerName, totalNewUsers, totalSwitchUsers } = stat;
    result[providerName] = { totalNewUsers, totalSwitchUsers };
  });

  return result;
};

const getProviderUserStats = async (providerName, startDate, endDate) => {
  const userReports = await findUserReports({
    providerName,
    startDate,
    endDate,
    type: REPORT_TYPE.DAY,
  });
  const result = userReports.reduce(
    (stats, report) => {
      const { totalNewUsers = 0, totalSwitchUsers = 0 } = report;
      stats.totalNewUsers += totalNewUsers;
      stats.totalSwitchUsers += totalSwitchUsers;
      return stats;
    },
    {
      totalNewUsers: 0,
      totalSwitchUsers: 0,
    },
  );
  return result;
};

/**
 * get user stats in a date
 * @param {string} providerName
 * @param {Date} date
 * @returns {Object} { totalNewUsers, totalSwitchUsers }
 */
const getDateUserStats = async (providerName, date) => {
  const startDate = moment(date).startOf('day').toISOString();
  const endDate = moment(date).endOf('day').toISOString();
  const stats = await getProviderUserStats(providerName, startDate, endDate);
  return stats;
};

const getMonthUserStats = async (providerName, date) => {
  const startDate = moment(date).startOf('month').toISOString();
  const endDate = moment(date).endOf('day').toISOString();
  const stats = await getProviderUserStats(providerName, startDate, endDate);
  return stats;
};

module.exports = {
  findUserReports,
  getDateUserStats,
  getMonthUserStats,
  statsUserByProvider,
};
