const { RECONCILE_TYPE } = require('../../constants/reconcileOrder');
const { CURRENCY_UNIT } = require('../../constants/reconcileOrder');
const ReconcileOrder = require('../../model/reconcileOrder');
const { getUsdToVndRate } = require('../currencyExchangeRate');
const { getDateQuery } = require('../utils');

const statsRevenueByFeeType = async ({
  startDate,
  endDate,
  type,
  usdToVndRate,
}) => {
  const dateQuery = getDateQuery('time', startDate, endDate);

  const data = await ReconcileOrder.aggregate([
    {
      $match: {
        ...dateQuery,
        type,
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
        _id: '$feeType.name',
        total: {
          $sum: {
            $cond: {
              if: { $eq: ['$currencyUnit', CURRENCY_UNIT.DOLLAR] },
              then: { $multiply: ['$money', usdToVndRate] },
              else: '$money',
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        feeType: '$_id',
        total: 1,
      },
    },
  ]);

  if (!data?.length) return {};

  const statsResult = {};
  data.forEach((item) => {
    statsResult[item.feeType] = item.total;
  });

  return statsResult;
};

const statsRevenueByProvider = async ({
  startDate,
  endDate,
  type,
  usdToVndRate,
}) => {
  const dateQuery = getDateQuery('time', startDate, endDate);

  const data = await ReconcileOrder.aggregate([
    {
      $match: {
        ...dateQuery,
        type,
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
      $group: {
        _id: '$provider.name',
        total: {
          $sum: {
            $cond: {
              if: { $eq: ['$currencyUnit', CURRENCY_UNIT.DOLLAR] },
              then: { $multiply: ['$money', usdToVndRate] },
              else: '$money',
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        provider: '$_id',
        total: 1,
      },
    },
  ]);

  if (!data?.length) return {};

  const statsResult = {};
  data.forEach((item) => {
    statsResult[item.provider] = item.total;
  });

  return statsResult;
};

const statsRevenueByChannel = async ({
  startDate,
  endDate,
  type,
  usdToVndRate,
}) => {
  const dateQuery = getDateQuery('time', startDate, endDate);

  const data = await ReconcileOrder.aggregate([
    {
      $match: {
        ...dateQuery,
        type,
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
      $group: {
        _id: '$channel.name',
        total: {
          $sum: {
            $cond: {
              if: { $eq: ['$currencyUnit', CURRENCY_UNIT.DOLLAR] },
              then: { $multiply: ['$money', usdToVndRate] },
              else: '$money',
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        channel: '$_id',
        total: 1,
      },
    },
  ]);

  if (!data?.length) return {};

  const statsResult = {};
  data.forEach((item) => {
    statsResult[item.channel] = item.total;
  });

  return statsResult;
};

const statsRevenueByChannelByDate = async ({
  startDate,
  endDate,
  type,
  providerName,
  feeType,
  query,
}) => {
  const usdToVndRate = await getUsdToVndRate();
  const dateQuery = getDateQuery('time', startDate, endDate);
  const pipeline = [];

  const matchQuery = { type, ...dateQuery, ...query };
  if (feeType) {
    pipeline.push(
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
    );
    matchQuery['feeType.name'] = feeType;
  }
  if (providerName) {
    pipeline.push(
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
    );
    matchQuery['provider.name'] = providerName;
  }

  pipeline.push({ $match: matchQuery });

  pipeline.push(
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
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: type === RECONCILE_TYPE.DAY ? '%Y-%m-%d' : '%Y-%m',
              date: '$time',
            },
          },
          channel: '$channel.name',
        },
        total: {
          $sum: {
            $cond: {
              if: { $eq: ['$currencyUnit', CURRENCY_UNIT.DOLLAR] },
              then: { $multiply: ['$money', usdToVndRate] },
              else: '$money',
            },
          },
        },
      },
    },
    { $sort: { '_id.date': 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id.date',
        channel: '$_id.channel',
        total: 1,
      },
    },
  );
  const data = await ReconcileOrder.aggregate(pipeline);

  if (!data?.length) return {};

  const statsMap = new Map();
  data.forEach((item) => {
    const { date, channel, total } = item;
    if (!statsMap.has(date)) {
      statsMap.set(date, {});
    }
    statsMap.get(date)[channel] = total;
  });

  const statsResult = {};
  statsMap.forEach((value, key) => {
    statsResult[key] = value;
  });

  // console.log('statsResult: ', statsResult);

  return statsResult;
};

module.exports = {
  statsRevenueByFeeType,
  statsRevenueByProvider,
  statsRevenueByChannel,
  statsRevenueByChannelByDate,
};
