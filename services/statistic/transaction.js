const moment = require('moment');
const { PARTNER_REVENUE_SLACK_CHANNEL } = require('../../configs');
const {
  TRANSACTION_STATE,
  PAY_TYPE,
  VBEE_SUB_PRODUCTS,
} = require('../../constants');
const { statsRevenueByPartnerAndProvider } = require('../../daos/transaction');
const Transaction = require('../../model/transaction');
const { getUsdToVndRate } = require('../currencyExchangeRate');
const { sendPartnerRevenueSlackNoti } = require('../notification/slack');
const { getDateQuery } = require('../utils');
const { convertToProduct } = require('../vbeeLabels');

const countRevenue = async (query, usdToVndRate) => {
  const { startDate, endDate, providerName, type, partnerName, channelName } =
    query;
  const dateQuery = getDateQuery('createdAt', startDate, endDate);
  const matchQuery = { ...dateQuery, state: TRANSACTION_STATE.SUCCESS };
  const pipeline = [];
  if (type) matchQuery.type = type;
  if (partnerName) {
    pipeline.push(
      {
        $lookup: {
          from: 'partners',
          localField: 'partner',
          foreignField: '_id',
          as: 'partner',
        },
      },
      {
        $unwind: {
          path: '$partner',
        },
      },
    );
    matchQuery['partner.name'] = partnerName;
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
  if (channelName) {
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
    );
    matchQuery['channel.name'] = channelName;
  }

  pipeline.push({ $match: matchQuery });
  pipeline.push({
    $group: {
      _id: null,
      total: {
        $sum: {
          $cond: {
            if: {
              $or: [
                { $eq: ['$type', 'paypal'] },
                { $eq: ['$type', '2checkout'] },
              ],
            },
            then: { $multiply: ['$money', usdToVndRate] },
            else: '$money',
          },
        },
      },
    },
  });

  const data = await Transaction.aggregate(pipeline);
  if (!data?.length) {
    return 0;
  }

  const [{ total: totalRevenue }] = data;

  return totalRevenue;
};

const getProviderRevenue = async (providerName, date) => {
  const usdToVndRate = await getUsdToVndRate();
  const dateRevenue = await countRevenue(
    {
      providerName,
      startDate: moment(date).startOf('day').toISOString(),
      endDate: moment(date).endOf('day').toISOString(),
    },
    usdToVndRate,
  );
  const monthRevenue = await countRevenue(
    {
      providerName,
      startDate: moment(date).startOf('month').toISOString(),
      endDate: moment(date).endOf('day').toISOString(),
    },
    usdToVndRate,
  );
  return { dateRevenue, monthRevenue };
};

const statsRevenueByPartner = async ({ startDate, endDate, usdToVndRate }) => {
  const dateQuery = getDateQuery('createdAt', startDate, endDate);

  const data = await Transaction.aggregate([
    {
      $match: {
        ...dateQuery,
        state: TRANSACTION_STATE.SUCCESS,
      },
    },
    {
      $lookup: {
        from: 'partners',
        localField: 'partner',
        foreignField: '_id',
        as: 'partner',
      },
    },
    {
      $unwind: {
        path: '$partner',
      },
    },
    {
      $group: {
        _id: '$partner.name',
        total: {
          $sum: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$type', 'paypal'] },
                  { $eq: ['$type', '2checkout'] },
                ],
              },
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
        partner: '$_id',
        total: 1,
      },
    },
  ]);

  if (!data?.length) return {};

  const statsResult = {};
  data.forEach((item) => {
    statsResult[item.partner] = item.total;
  });

  return statsResult;
};

const statsRevenueByState = async ({ startDate, endDate, usdToVndRate }) => {
  const dateQuery = getDateQuery('createdAt', startDate, endDate);

  const data = await Transaction.aggregate([
    {
      $match: {
        ...dateQuery,
      },
    },
    {
      $group: {
        _id: '$state',
        total: {
          $sum: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$type', 'paypal'] },
                  { $eq: ['$type', '2checkout'] },
                ],
              },
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
        state: '$_id',
        total: 1,
      },
    },
  ]);

  if (!data?.length) return {};

  const statsResult = {};
  data.forEach((item) => {
    let key;
    switch (item.state) {
      case TRANSACTION_STATE.PROCESSING:
        key = 'processing';
        break;
      case TRANSACTION_STATE.SUCCESS:
        key = 'success';
        break;
      default:
        key = 'failed';
        break;
    }
    statsResult[key] = item.total;
  });

  return statsResult;
};

const statsRevenueByProvider = async ({ startDate, endDate, usdToVndRate }) => {
  const dateQuery = getDateQuery('createdAt', startDate, endDate);

  const data = await Transaction.aggregate([
    {
      $match: {
        ...dateQuery,
        state: TRANSACTION_STATE.SUCCESS,
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
              if: {
                $or: [
                  { $eq: ['$type', 'paypal'] },
                  { $eq: ['$type', '2checkout'] },
                ],
              },
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

const statsRevenueByChannel = async ({ startDate, endDate, usdToVndRate }) => {
  const dateQuery = getDateQuery('createdAt', startDate, endDate);

  const data = await Transaction.aggregate([
    {
      $match: {
        ...dateQuery,
        state: TRANSACTION_STATE.SUCCESS,
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
              if: {
                $or: [
                  { $eq: ['$type', 'paypal'] },
                  { $eq: ['$type', '2checkout'] },
                ],
              },
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
  usdToVndRate,
}) => {
  const dateQuery = getDateQuery('createdAt', startDate, endDate);
  const data = await Transaction.aggregate([
    {
      $match: {
        ...dateQuery,
        state: TRANSACTION_STATE.SUCCESS,
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
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          channel: '$channel.name',
        },
        total: {
          $sum: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$type', 'paypal'] },
                  { $eq: ['$type', '2checkout'] },
                ],
              },
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
  ]);

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

  return statsResult;
};

const statsRevenueByProviderByDate = async ({
  startDate,
  endDate,
  usdToVndRate,
}) => {
  const dateQuery = getDateQuery('createdAt', startDate, endDate);
  const data = await Transaction.aggregate([
    {
      $match: {
        ...dateQuery,
        state: TRANSACTION_STATE.SUCCESS,
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
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          provider: '$provider.name',
        },
        total: {
          $sum: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$type', 'paypal'] },
                  { $eq: ['$type', '2checkout'] },
                ],
              },
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
        provider: '$_id.provider',
        total: 1,
      },
    },
  ]);

  if (!data?.length) return {};

  const statsMap = new Map();
  data.forEach((item) => {
    const { date, provider, total } = item;
    if (!statsMap.has(date)) {
      statsMap.set(date, {});
    }
    statsMap.get(date)[provider] = total;
  });

  const statsResult = {};
  statsMap.forEach((value, key) => {
    statsResult[key] = value;
  });

  return statsResult;
};

const statsRevenueByPartnerByDate = async ({
  startDate,
  endDate,
  usdToVndRate,
}) => {
  const dateQuery = getDateQuery('createdAt', startDate, endDate);
  const data = await Transaction.aggregate([
    {
      $match: {
        ...dateQuery,
        state: TRANSACTION_STATE.SUCCESS,
      },
    },
    {
      $lookup: {
        from: 'partners',
        localField: 'partner',
        foreignField: '_id',
        as: 'partner',
      },
    },
    {
      $unwind: {
        path: '$partner',
      },
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          partner: '$partner.name',
        },
        total: {
          $sum: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$type', 'paypal'] },
                  { $eq: ['$type', '2checkout'] },
                ],
              },
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
        partner: '$_id.partner',
        total: 1,
      },
    },
  ]);

  if (!data?.length) return {};

  const statsMap = new Map();
  data.forEach((item) => {
    const { date, partner, total } = item;
    if (!statsMap.has(date)) {
      statsMap.set(date, {});
    }
    statsMap.get(date)[partner] = total;
  });

  const statsResult = {};
  statsMap.forEach((value, key) => {
    statsResult[key] = value;
  });

  return statsResult;
};

const convertToProductRevenue = (partnerRevenue) => {
  const res = {
    [VBEE_SUB_PRODUCTS.AI_VOICE_SUB]: { partners: [], revenue: 0 },
    [VBEE_SUB_PRODUCTS.SMART_IVR_SUB]: { partners: [], revenue: 0 },
  };
  partnerRevenue.forEach((item) => {
    const { partner, provider, revenue } = item;
    const providerLabel = convertToProduct(provider, PAY_TYPE.SUB);
    if (!res[providerLabel]) {
      res[providerLabel] = { partners: [], revenue: 0 };
    }
    res[providerLabel].revenue += revenue;

    const resPartner = res[providerLabel].partners.find(
      (p) => p.name === partner,
    );
    if (resPartner) {
      resPartner.revenue += revenue;
    } else {
      res[providerLabel].partners.push({ name: partner, revenue });
    }
  });

  return res;
};

const notifyPartnerRevenue = async (date) => {
  const usdToVndRate = await getUsdToVndRate();
  const datePartnerRevenues = await statsRevenueByPartnerAndProvider({
    startDate: moment(date).utcOffset(7).startOf('day').toDate(),
    endDate: moment(date).utcOffset(7).endOf('day').toDate(),
    usdToVndRate,
  });
  const monthPartnerRevenues = await statsRevenueByPartnerAndProvider({
    startDate: moment(date).utcOffset(7).startOf('month').toDate(),
    endDate: moment(date).utcOffset(7).endOf('day').toDate(),
    usdToVndRate,
  });

  const dateRevenues = convertToProductRevenue(datePartnerRevenues);
  const monthRevenues = convertToProductRevenue(monthPartnerRevenues);

  await sendPartnerRevenueSlackNoti(PARTNER_REVENUE_SLACK_CHANNEL, {
    date,
    dateRevenues,
    monthRevenues,
  });
};

module.exports = {
  countRevenue,
  getProviderRevenue,
  statsRevenueByPartner,
  statsRevenueByState,
  statsRevenueByProvider,
  statsRevenueByChannel,
  statsRevenueByChannelByDate,
  statsRevenueByProviderByDate,
  statsRevenueByPartnerByDate,
  notifyPartnerRevenue,
};
