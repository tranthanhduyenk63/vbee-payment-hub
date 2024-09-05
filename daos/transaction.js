const { TRANSACTION_STATE } = require('../constants');
const Transaction = require('../model/transaction');
const { getDateQuery } = require('./utils/util');

const statsRevenueByPartnerAndProvider = async ({
  startDate,
  endDate,
  usdToVndRate,
}) => {
  const pipeline = [
    {
      $match: {
        ...getDateQuery('createdAt', startDate, endDate),
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
    { $unwind: { path: '$provider' } },
    {
      $lookup: {
        from: 'partners',
        localField: 'partner',
        foreignField: '_id',
        as: 'partner',
      },
    },
    { $unwind: { path: '$partner' } },
    {
      $group: {
        _id: {
          provider: '$provider.name',
          partner: '$partner.name',
        },
        revenue: {
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
        provider: '$_id.provider',
        partner: '$_id.partner',
        revenue: 1,
      },
    },
  ];

  const result = await Transaction.aggregate(pipeline);
  return result;
};

module.exports = { statsRevenueByPartnerAndProvider };
