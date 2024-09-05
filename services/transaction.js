/* eslint-disable indent */
/* eslint-disable no-unused-vars */
const moment = require('moment');
const Transaction = require('../model/transaction');
const { createConfirmation } = require('./customerConfirmation');
const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');
const { TRANSACTION_STATE, CONFIRM_TRANSACTION_BY } = require('../constants');
const {
  getDateQuery,
  getSortQuery,
  getSelectQuery,
  getSearchQuery,
} = require('./utils');
const { convertTransactionsToExcel } = require('../utils/convertToExcel');
const { upload_data } = require('../lib/utils');
const { BUCKET_NAME, SYNC_HOLDING_TIME } = require('../configs');
const logger = require('../utils/logger');
const { createPresignedUrlForSharing } = require('./s3/presignedUrl');
const { getProvider } = require('./provider');
const { getBank, updateBankSyncData, forceSyncBank } = require('./bank');

const findTransaction = async (condition = {}) => {
  const transaction = await Transaction.findOne(condition)
    .populate(['channel', 'partner', 'provider'])
    .lean();
  return transaction;
};

const findAppleTransactionForIPN = async ({
  transactionId,
  appleTransactionId,
}) => {
  const transactionAlreadyProcessed = await Transaction.findOne({
    type: 'apple',
    'additionalData.appleTransactionId': appleTransactionId,
  });
  if (transactionAlreadyProcessed) {
    logger.info(`Transaction ${appleTransactionId} already processed`, {
      ctx: 'FindAppleTransaction',
    });
    return null;
  }

  const transaction = await Transaction.findOne({
    type: 'apple',
    appstoreTransactionId: transactionId,
  })
    .populate(['channel', 'partner', 'provider'])
    .lean();
  return transaction;
};

const updateTransaction = async (find, update) => {
  const transaction = await Transaction.findOneAndUpdate(find, update, {
    new: true,
  });
  return transaction;
};

const confirmSuccessTransaction = async ({
  confirmBy,
  type,
  link,
  appstoreTransactionId,
  bankCode,
  providerName,
}) => {
  if (!link && !appstoreTransactionId && !bankCode) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Query is invalid');
  }

  const onlineTypes = [
    'atm',
    'visa',
    'momopay',
    'zalopay',
    'paypal',
    'shopeepay',
  ];

  let query;

  if (['google', 'apple'].includes(type)) {
    query = { appstoreTransactionId };
  } else if (type === 'bank') {
    query = { 'bank.code': bankCode };
  } else if (onlineTypes.includes(type)) {
    query = { link };
  } else {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Type is invalid');
  }

  let transaction = await findTransaction(query);
  if (!transaction) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Transaction not found',
    );
  }

  const matchedTransactionOfProvider =
    // eslint-disable-next-line prettier/prettier
    confirmBy === CONFIRM_TRANSACTION_BY.PROVIDER &&
    transaction.provider?.name !== providerName;

  if (matchedTransactionOfProvider) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Provider have no permission to update this transaction',
    );
  }
  if (transaction.state !== TRANSACTION_STATE.PROCESSING) {
    throw new CustomError(ERROR_CODE.CONFIRMED_TRANSACTION);
  }

  // TODO: update các chỗ update transaction => confirm by
  transaction = await Transaction.findByIdAndUpdate(transaction._id, {
    state: TRANSACTION_STATE.SUCCESS,
    confirmBy,
  });
};

const confirmTransactionByCustomer = async ({
  providerName,
  customerId,
  code,
  bankNumber,
}) => {
  const provider = await getProvider(providerName);
  if (!provider) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Provider not found');
  }

  await createConfirmation({
    customerId,
    code,
    bankNumber,
    provider: provider._id,
  });

  const bank = await getBank({ bankNumber, provider: provider._id });
  if (!bank) return;
  if (
    !bank.lastSyncTime ||
    moment().diff(moment(bank.lastSyncTime), 's') > SYNC_HOLDING_TIME
  ) {
    await forceSyncBank(bankNumber);
    return;
  }
  if (bank.isSyncHolding) return;

  // wait 1 minute before force sync
  await updateBankSyncData({ bankNumber, isSyncHolding: true });
  await new Promise((resolve, reject) => {
    setTimeout(() => {
      forceSyncBank(bankNumber)
        .then(() => resolve())
        .catch((err) => reject(err));
    }, SYNC_HOLDING_TIME * 1000);
  });
};

/**
 * this function find transactions by partnerName, channelName, providerName, and dateField
 * can choose which fields to return
 * @param {object} condition - condition to find transactions
 * @returns array of transactions
 */
const findTransactions = async (condition = {}) => {
  logger.info({ condition }, { ctx: 'findTransactions' });
  const {
    search,
    searchFields,
    offset,
    limit,
    fields,
    dateField = 'createdAt',
    sort,
    query,
  } = condition;

  const pipeline = [
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
  ];

  let matchQuery = {};

  if (query.partnerName) {
    matchQuery['partner.name'] = query.partnerName;
    delete query.partnerName;
  }

  if (query.providerName) {
    matchQuery['provider.name'] = query.providerName;
    delete query.providerName;
  }

  if (query.channelName) {
    matchQuery['channel.name'] = query.channelName;
    delete query.channelName;
  }

  if (query.startDate || query.endDate) {
    const dateQuery = getDateQuery(dateField, query.startDate, query.endDate);
    delete query.startDate;
    delete query.endDate;
    matchQuery = { ...matchQuery, ...dateQuery };
  }

  if (query.state) {
    matchQuery.state = parseInt(query.state, 10);
    delete query.state;
  }

  matchQuery = { ...matchQuery, ...query };

  pipeline.push({
    $match: search
      ? {
          $or: getSearchQuery(Transaction, searchFields.split(','), search),
          ...matchQuery,
        }
      : matchQuery,
  });

  const filterPipeline = [];
  if (sort) filterPipeline.push({ $sort: getSortQuery(sort) });
  filterPipeline.push({ $skip: offset || 0 });
  if (limit) filterPipeline.push({ $limit: limit });
  if (fields) filterPipeline.push({ $project: getSelectQuery(fields) });

  logger.info({ ...pipeline, ...filterPipeline }, { ctx: 'findTransactions' });

  const totalTransactions = await Transaction.aggregate([
    ...pipeline,
    { $group: { _id: null, total: { $sum: 1 } } },
  ]);

  if (!totalTransactions?.length) return { total: 0, transactions: [] };
  const { total } = totalTransactions[0];

  const transactions = await Transaction.aggregate([
    ...pipeline,
    ...filterPipeline,
  ]);

  return { transactions, total };
};

const exportTransactionsToExcel = async (query) => {
  const { transactions } = await findTransactions(query);
  if (!transactions?.length) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Transaction not found',
    );
  }

  const workbook = convertTransactionsToExcel(transactions);

  const fileName = `transactions-${Date.now()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  await upload_data(BUCKET_NAME, fileName, buffer);
  const signedUrl = await createPresignedUrlForSharing({ key: fileName });

  return signedUrl;
};

const findMismatchedTransactions = async (condition = {}) => {
  const { partnerName, startDate, endDate } = condition;
  if (!partnerName || !startDate || !endDate) return [];

  const pipeline = [
    {
      $match: {
        type: partnerName,
        ...getDateQuery('createdAt', startDate, endDate),
      },
    },
    {
      $project: getSelectQuery(
        '_id,customerId,transactionId,type,money,state,recheckMoney,recheckState,isRecheckFinal,createdAt',
      ),
    },
  ];
  const transactions = await Transaction.aggregate(pipeline);
  const res = transactions.filter((transaction) => {
    const money =
      transaction.state === TRANSACTION_STATE.SUCCESS ? transaction.money : 0;
    return money !== transaction.recheckMoney;
  });
  return res;
};

module.exports = {
  findTransaction,
  findAppleTransactionForIPN,
  confirmSuccessTransaction,
  confirmTransactionByCustomer,
  exportTransactionsToExcel,
  findTransactions,
  updateTransaction,
  findMismatchedTransactions,
};
