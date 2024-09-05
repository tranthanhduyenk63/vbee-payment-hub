/* eslint-disable max-len */
const moment = require('moment');

const Channel = require('../model/channel');
const Provider = require('../model/provider');
const FeeType = require('../model/feeType');
const RevenueReport = require('../model/revenueReport');
const UserReport = require('../model/userReport');

const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');
const { getDateQuery, getSortQuery } = require('./utils');
const { REPORT_TYPE } = require('../constants');
const logger = require('../utils/logger');
const { REVENUE_SME_PROVIDERS } = require('../configs');

const createRevenueReports = async ({
  clientId,
  type,
  time,
  channel,
  provider,
  userReport,
  revenueReports,
}) => {
  const channelDoc = await Channel.findOne({ name: channel }).lean();
  if (!channelDoc) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Channel not exists');
  }

  const providerDoc = await Provider.findOne({ name: provider }).lean();
  if (!providerDoc) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Provider not exists');
  }

  const { validIAMClientIds = [] } = providerDoc;
  if (!validIAMClientIds.includes(clientId)) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      `${clientId} cannot create revenue reports for provider ${provider}`,
    );
  }

  const timeInReport = moment(time).utcOffset(7).endOf('day').toISOString();
  const allFeeTypes = await FeeType.find().lean();

  const existRevenueReport = await RevenueReport.findOne({
    type,
    channel: channelDoc._id,
    provider: providerDoc._id,
    time: timeInReport,
  }).lean();

  const existUserReport = await UserReport.findOne({
    type,
    channel: channelDoc._id,
    provider: providerDoc._id,
    time: timeInReport,
  }).lean();

  if (existRevenueReport || existUserReport) {
    if (!channelDoc.allowPushReconcileAgain) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        null,
        'Revenue this day is already reported',
      );
    }

    await RevenueReport.deleteMany({
      type,
      channel: channelDoc._id,
      provider: providerDoc._id,
      time: timeInReport,
    });

    await UserReport.deleteMany({
      type,
      channel: channelDoc._id,
      provider: providerDoc._id,
      time: timeInReport,
    });
  }

  const revenueReportsInfo = revenueReports.map((report) => {
    const feeTypeDoc = allFeeTypes.find(
      (feeType) => feeType.name === report.feeType,
    );

    if (!feeTypeDoc) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        null,
        `${report.feeType} does not exists`,
      );
    }

    const revenueReport = {
      ...report,
      time: timeInReport,
      type,
      provider: providerDoc._id,
      channel: channelDoc._id,
      feeType: feeTypeDoc._id,
    };

    return revenueReport;
  });

  await UserReport.create({
    type,
    time: timeInReport,
    provider: providerDoc._id,
    channel: channelDoc._id,
    totalNewUsers: userReport.totalNewUsers,
    totalSwitchUsers: userReport.totalSwitchUsers,
  });
  await RevenueReport.insertMany(revenueReportsInfo);
};

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

// return { revenue: { <feeType>: xx }, quantity: {}, specificQuantity: {}, currencyUnit, unit }
const getProviderExpectedRevenue = async (providerName, startDate, endDate) => {
  const result = {
    revenue: {},
    quantity: {},
    specificQuantity: {},
    totalPricedQuantity: {},
    priceUnit: {},
    totalCalledContacts: {},
    currencyUnit: '',
    unit: '',
  };

  const revenueReports = await findRevenueReports({
    providerName,
    startDate,
    endDate,
    sort: 'time_desc',
    type: REPORT_TYPE.DAY,
  });
  revenueReports.forEach((report) => {
    const {
      revenue,
      quantity,
      specificQuantity = {},
      feeType,
      unit,
      currencyUnit,
      totalPricedQuantity = 0,
      priceUnit,
      totalCalledContacts = 0,
    } = report;
    const { name: feeTypeName } = feeType || {};

    if (!result.revenue[feeTypeName]) result.revenue[feeTypeName] = 0;
    if (!result.quantity[feeTypeName]) result.quantity[feeTypeName] = 0;
    if (!result.priceUnit[feeTypeName]) result.priceUnit[feeTypeName] = '';
    if (!result.totalPricedQuantity[feeTypeName]) {
      result.totalPricedQuantity[feeTypeName] = 0;
    }
    if (!result.totalCalledContacts[feeTypeName]) {
      result.totalCalledContacts[feeTypeName] = 0;
    }

    specificQuantity.forEach((spec) => {
      const { label, quantity: specQuantity } = spec;
      if (!result.specificQuantity[label]) result.specificQuantity[label] = {};
      if (!result.specificQuantity[label][feeTypeName]) {
        result.specificQuantity[label][feeTypeName] = 0;
      }
      result.specificQuantity[label][feeTypeName] += specQuantity;
    });

    result.revenue[feeTypeName] += revenue;
    result.quantity[feeTypeName] += quantity;
    result.priceUnit[feeTypeName] = priceUnit || result.priceUnit[feeTypeName];
    result.totalPricedQuantity[feeTypeName] += totalPricedQuantity;
    result.totalCalledContacts[feeTypeName] += totalCalledContacts;
    result.unit = unit;
    result.currencyUnit = currencyUnit;
  });

  return result;
};

const getExpectedDateRevenue = async (providerName, date) => {
  const startDate = moment(date).startOf('day').toISOString();
  const endDate = moment(date).endOf('day').toISOString();
  const revenue = await getProviderExpectedRevenue(
    providerName,
    startDate,
    endDate,
  );
  return revenue;
};

const getExpectedMonthRevenue = async (providerName, date) => {
  const startDate = moment(date).startOf('month').toISOString();
  const endDate = moment(date).endOf('day').toISOString();
  const revenue = await getProviderExpectedRevenue(
    providerName,
    startDate,
    endDate,
  );
  return revenue;
};

const getExpectedYearRevenue = async (providerName, date) => {
  const startDate = moment(date).startOf('year').toISOString();
  const endDate = moment(date).endOf('day').toISOString();
  const revenue = await getProviderExpectedRevenue(
    providerName,
    startDate,
    endDate,
  );
  return revenue;
};

/**
 * @returns { Promise<[ { providerName, feeType, revenue, quantity, specificQuantity, currencyUnit, unit }] }> }
 */
const getSmeRevenue = async ({ startDate, endDate }) => {
  const revenueReports = await RevenueReport.aggregate([
    {
      $match: {
        type: REPORT_TYPE.DAY,
        time: { $gte: new Date(startDate), $lte: new Date(endDate) },
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
    { $match: { 'provider.name': { $in: REVENUE_SME_PROVIDERS } } },
    {
      $lookup: {
        from: 'feetypes',
        localField: 'feeType',
        foreignField: '_id',
        as: 'feeType',
      },
    },
    { $unwind: { path: '$feeType' } },
    {
      $project: {
        provider: '$provider.name',
        feeType: '$feeType.name',
        revenue: 1,
        quantity: 1,
        specificQuantity: 1,
        currencyUnit: 1,
        unit: 1,
      },
    },
  ]);

  const smeRevenue = [];
  revenueReports?.forEach((revenueReport) => {
    // eslint-disable-next-line prettier/prettier
    const { provider, feeType, revenue, quantity, specificQuantity, currencyUnit, unit } = revenueReport;
    let revenueItem = smeRevenue.find(
      (item) => item.providerName === provider && item.feeType === feeType,
    );
    if (!revenueItem) {
      revenueItem = {
        providerName: provider,
        feeType,
        revenue: 0,
        quantity: 0,
        specificQuantity: [],
        currencyUnit,
        unit,
      };
      smeRevenue.push(revenueItem);
    }

    revenueItem.revenue += revenue;
    revenueItem.quantity += quantity;
    specificQuantity.forEach(({ label, quantity: specQuantity }) => {
      const quantityItem = revenueItem.specificQuantity.find(
        (item) => item.label === label,
      );
      if (!quantityItem) {
        revenueItem.specificQuantity.push({ label, quantity: specQuantity });
      } else {
        quantityItem.quantity += specQuantity;
      }
    });
  });

  return smeRevenue;
};

module.exports = {
  createRevenueReports,
  getExpectedDateRevenue,
  getExpectedMonthRevenue,
  getExpectedYearRevenue,
  getSmeRevenue,
};
