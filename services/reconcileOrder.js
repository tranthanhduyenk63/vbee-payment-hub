/* eslint-disable no-unused-vars */
const moment = require('moment');
const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');

const Channel = require('../model/channel');
const Provider = require('../model/provider');
const ReconcileOrder = require('../model/reconcileOrder');
const FeeType = require('../model/feeType');
const {
  RECONCILE_TYPE,
  CURRENCY_UNIT,
} = require('../constants/reconcileOrder');
const logger = require('../utils/logger');
const { convertReconcileOrdersToExcel } = require('../utils/convertToExcel');
const { upload_data } = require('../lib/utils');
const { BUCKET_NAME } = require('../configs');
const { getDateQuery, getSortQuery } = require('./utils');
const { createPresignedUrlForSharing } = require('./s3/presignedUrl');
const { sendRevenueSlackNoti } = require('./notification/slack');

const checkReconcileOrderExists = async ({
  type,
  providerId,
  channelId,
  time,
  customerId,
}) => {
  const reconcileOrder = await ReconcileOrder.findOne({
    type,
    provider: providerId,
    channel: channelId,
    time,
    customerId,
  });

  if (reconcileOrder) return true;

  return false;
};

/**
 *
 * data: {
 *  type: DAY or MONTH
 *  time: reconcile time - which day or which month (ISO Date string format)
 *  channel: Channel which provider belongs
 *  providerName
 *  reconcileOrders: [{ currencyUnit, customerId, money, feeType, quantity, numberRequest }]
 * }
 */
const createReconcileOrders = async (data) => {
  const { providerName, type } = data;
  let { reconcileOrders, time, channel } = data;

  logger.info(
    `reconcile createion data: ${JSON.stringify({
      time,
      channel,
      providerName,
      type,
    })}`,
    { ctx: 'createReconcileOrders' },
  );

  const provider = await Provider.findOne({ name: providerName });
  if (!provider) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Provider not found');
  }

  channel = await Channel.findOne({ name: channel });
  if (!channel) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Channel not found');
  }

  // if (!providerName.includes(channel.name)) {
  //   throw new CustomError(
  //     ERROR_CODE.BAD_REQUEST,
  //     null,
  //     'Channel and Provider are conflicted',
  //   );
  // }

  if (!Object.values(RECONCILE_TYPE).includes(type)) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Type invalid');
  }

  if (!time) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Time invalid');
  }
  if (type === RECONCILE_TYPE.DAY) {
    time = moment(time).utcOffset(7).endOf('day').toISOString();
  } else {
    time = moment(time).utcOffset(7).endOf('month').toISOString();
  }

  if (!reconcileOrders?.length) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'ReconcileOrder must be array having length greater than 0',
    );
  }

  reconcileOrders = await Promise.all(
    reconcileOrders.map(async (item) => {
      const { currencyUnit, customerId, money, feeType, quantity } = item;

      const reconcileExist = await checkReconcileOrderExists({
        type,
        providerId: provider._id,
        channelId: channel._id,
        time,
        customerId,
      });
      if (reconcileExist && !channel.allowPushReconcileAgain) {
        throw new CustomError(ERROR_CODE.PUSHED_RECONCILE_ORDER);
      }
      if (reconcileExist && channel.allowPushReconcileAgain) {
        await ReconcileOrder.deleteOne({
          time,
          type,
          customerId,
          provider: provider._id,
          channel: channel._id,
        });
      }

      const feeTypeDoc = await FeeType.findOne({ name: feeType });
      if (!feeTypeDoc) {
        throw new CustomError(
          ERROR_CODE.BAD_REQUEST,
          null,
          'Fee type is invalid',
        );
      }

      if (!Object.values(CURRENCY_UNIT).includes(currencyUnit)) {
        throw new CustomError(
          ERROR_CODE.BAD_REQUEST,
          null,
          'Currency unit is invalid',
        );
      }

      if (!customerId || money === undefined || quantity === undefined) {
        const missingFields = [];
        if (!customerId) missingFields.push('"customerId"');
        if (money === undefined) missingFields.push('"money"');
        if (quantity === undefined) missingFields.push('"quantity"');
        throw new CustomError(
          ERROR_CODE.BAD_REQUEST,
          null,
          `Miss field ${missingFields.join(',')} in reconcile order element`,
        );
      }

      return {
        ...item,
        type,
        time,
        provider: provider._id,
        channel: channel._id,
        feeType: feeTypeDoc._id,
      };
    }),
  );

  await ReconcileOrder.insertMany(reconcileOrders);
};

/**
 * this function find reconcile orders by providerName, channelName,
 * customerId, time or feeType, type
 * @param {*} condition
 * @returns array of reconcile orders
 */
const findReconcileOrders = async (condition = {}) => {
  logger.info({ condition }, { ctx: 'findReconcileOrders' });
  const {
    search,
    searchFields,
    fields,
    offset,
    limit,
    dateField = 'time',
    sort,
    query,
  } = condition;

  const pipeline = [
    {
      $lookup: {
        from: 'providers',
        localField: 'provider',
        foreignField: '_id',
        as: 'provider',
      },
    },
    {
      $unwind: {
        path: '$provider',
      },
    },
    {
      $lookup: {
        from: 'channels',
        localField: 'channel',
        foreignField: '_id',
        as: 'channel',
      },
    },
    {
      $unwind: {
        path: '$channel',
      },
    },
    {
      $lookup: {
        from: 'feetypes',
        localField: 'feeType',
        foreignField: '_id',
        as: 'feeType',
      },
    },
    {
      $unwind: {
        path: '$feeType',
      },
    },
  ];

  let matchQuery = {};
  if (query.startDate || query.endDate) {
    const dateQuery = getDateQuery(dateField, query.startDate, query.endDate);
    delete query.startDate;
    delete query.endDate;
    matchQuery = { ...dateQuery };
  }

  for (const [key, value] of Object.entries(query)) {
    switch (key) {
      case 'providerName':
        matchQuery = {
          ...matchQuery,
          'provider.name': value,
        };
        delete query.providerName;
        break;
      case 'channelName':
        matchQuery = {
          ...matchQuery,
          'channel.name': value,
        };
        delete query.channelName;
        break;
      case 'feeType':
        matchQuery = {
          ...matchQuery,
          'feeType.name': value,
        };
        delete query.feeType;
        break;
      default:
        matchQuery = {
          ...matchQuery,
          [key]: value,
        };
        break;
    }
  }

  pipeline.push({
    $match: matchQuery,
  });

  const filterPipeline = [];
  if (sort) filterPipeline.push({ $sort: getSortQuery(sort) });
  filterPipeline.push({ $skip: offset || 0 });
  if (limit) filterPipeline.push({ $limit: limit });
  filterPipeline.push({
    $project: {
      _id: 0,
      customerId: 1,
      time: 1,
      type: 1,
      money: 1,
      currencyUnit: 1,
      'channel.name': 1,
      'provider.name': 1,
      'feeType.name': 1,
      createdAt: 1,
      quantity: 1,
      numberRequest: 1,
    },
  });

  logger.info(
    { ...pipeline, ...filterPipeline },
    { ctx: 'findReconcileOrder' },
  );

  const totalReconcileOrders = await ReconcileOrder.aggregate([
    ...pipeline,
    { $group: { _id: null, total: { $sum: 1 } } },
  ]);

  if (!totalReconcileOrders?.length) return { total: 0, reconcileOrders: [] };
  const [{ total }] = totalReconcileOrders;
  const reconcileOrders = await ReconcileOrder.aggregate([
    ...pipeline,
    ...filterPipeline,
  ]);

  return { reconcileOrders, total };
};

const exportReconcileOrdersToExcel = async (query) => {
  const { reconcileOrders } = await findReconcileOrders(query);
  if (!reconcileOrders?.length) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Reconcile order not found',
    );
  }
  const workbook = convertReconcileOrdersToExcel(reconcileOrders);

  const fileName = `reconcile-orders-${Date.now()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  await upload_data(BUCKET_NAME, fileName, buffer);
  const signedUrl = await createPresignedUrlForSharing({ key: fileName });

  return signedUrl;
};

const notifyReconcileOrders = async ({ date, channel }) => {
  const { reconcileOrders } = await findReconcileOrders({
    query: {
      startDate: moment(date).startOf('day').toISOString(),
      endDate: moment(date).endOf('day').toISOString(),
      channelName: channel,
      type: RECONCILE_TYPE.DAY,
    },
    sort: 'time_desc',
  });

  /**
   * revenue: {
   *  aicc-cloud: {
   *    totalMoney: 10,
   *    totalQuantity: 100,
   *    aicc-ivr: {
   *      totalMoney: 1,
   *      totalQuantity: 10
   *    },
   *    ...other feeTypes
   *  },
   *  ...other providers
   * }
   */
  const revenue = {};
  reconcileOrders.forEach((order) => {
    const { provider, feeType, money, quantity } = order;
    if (!revenue[provider.name]) {
      revenue[provider.name] = {
        totalMoney: 0,
        totalQuantity: 0,
      };
    }
    revenue[provider.name].totalMoney += money;
    revenue[provider.name].totalQuantity += quantity;

    if (!revenue[provider.name][feeType.name]) {
      revenue[provider.name][feeType.name] = {
        totalMoney: 0,
        totalQuantity: 0,
      };
    }
    revenue[provider.name][feeType.name].totalMoney += money;
    revenue[provider.name][feeType.name].totalQuantity += quantity;
  });

  // calculate revenue of this month
  const monthReconcileOrders = await ReconcileOrder.aggregate([
    {
      $lookup: {
        from: 'channels',
        localField: 'channel',
        foreignField: '_id',
        as: 'channel',
      },
    },
    {
      $unwind: {
        path: '$channel',
      },
    },
    {
      $match: {
        'channel.name': channel,
        time: {
          $gte: new Date(moment(date).startOf('month')),
          $lte: new Date(moment(date).endOf('day')),
        },
        type: RECONCILE_TYPE.DAY,
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
    {
      $unwind: {
        path: '$provider',
      },
    },
    {
      $lookup: {
        from: 'feetypes',
        localField: 'feeType',
        foreignField: '_id',
        as: 'feeType',
      },
    },
    {
      $unwind: {
        path: '$feeType',
      },
    },
    {
      $group: {
        _id: {
          provider: '$provider',
          feeType: '$feeType',
        },
        money: { $sum: '$money' },
        quantity: { $sum: '$quantity' },
        time: { $min: '$time' },
      },
    },
    {
      $sort: {
        time: -1,
      },
    },
    {
      $project: {
        money: 1,
        quantity: 1,
        provider: '$_id.provider',
        feeType: '$_id.feeType',
      },
    },
  ]);

  const monthRevenue = {};
  monthReconcileOrders.forEach((order) => {
    const { provider, feeType, money, quantity } = order;
    if (!monthRevenue[provider.name]) {
      monthRevenue[provider.name] = {
        totalMoney: 0,
        totalQuantity: 0,
      };
    }
    monthRevenue[provider.name].totalMoney += money;
    monthRevenue[provider.name].totalQuantity += quantity;

    if (!monthRevenue[provider.name][feeType.name]) {
      monthRevenue[provider.name][feeType.name] = {
        totalMoney: 0,
        totalQuantity: 0,
      };
    }
    monthRevenue[provider.name][feeType.name].totalMoney += money;
    monthRevenue[provider.name][feeType.name].totalQuantity += quantity;
  });

  await sendRevenueSlackNoti(date, revenue, monthRevenue);
};

module.exports = {
  createReconcileOrders,
  findReconcileOrders,
  exportReconcileOrdersToExcel,
  notifyReconcileOrders,
};
