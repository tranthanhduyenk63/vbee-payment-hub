const { CONFIRM_TRANSACTION_BY, PAGINATION } = require('../constants');
const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');
const { verified_token } = require('../lib/utils');

const transactionService = require('../services/transaction');
const { getResponseNoCors } = require('../utils/function');
const { validateConfirmation } = require('../validation/customerConfirmation');

const getTransactionDetail = async (payload, context, callback) => {
  console.log(JSON.stringify(payload));
  const { token } = payload.pathParameters;

  if (!token) {
    throw new CustomError(ERROR_CODE.UNAUTHORIZED);
  }

  const verified_token_detail = await verified_token({ token });
  // eslint-disable-next-line prettier/prettier
  if (
    !verified_token_detail ||
    verified_token_detail.provider !== payload.providerName
  ) {
    throw new CustomError(ERROR_CODE.UNAUTHORIZED);
  }

  const transaction = await transactionService.findTransaction({
    _id: verified_token_detail.uuid,
  });
  if (!transaction) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Transaction not found',
    );
  }

  delete transaction.partner?.config;
  delete transaction.channel?.privateKey;
  delete transaction.link;

  return {
    statusCode: 200,
    body: JSON.stringify(transaction),
  };
};

const confirmTransactionByProvider = async (payload, context, callback) => {
  if (!payload.body) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const query = JSON.parse(payload.body);
  const { providerName } = payload;
  const { link, transactionId, code, type } = query;
  await transactionService.confirmSuccessTransaction({
    confirmBy: CONFIRM_TRANSACTION_BY.PROVIDER,
    type,
    link,
    bankCode: code,
    appstoreTransactionId: transactionId,
    providerName,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ error: 0 }),
  };
};

const confirmTransactionByAdmin = async (payload, context, callback) => {
  if (!payload.body) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const query = JSON.parse(payload.body);
  const { link, transactionId, code, type } = query;

  await transactionService.confirmSuccessTransaction({
    confirmBy: CONFIRM_TRANSACTION_BY.ADMIN,
    type,
    link,
    bankCode: code,
    appstoreTransactionId: transactionId,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ error: 0 }),
  };
};

const confirmTransactionByCustomer = async (payload, context, callback) => {
  if (!payload.body) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  validateConfirmation(payload.body);
  const { providerName } = payload;
  const query = JSON.parse(payload.body);

  const { customerId, code, bankNumber } = query;
  await transactionService.confirmTransactionByCustomer({
    providerName,
    customerId,
    code,
    bankNumber,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ error: 0 }),
  };
};

const exportTransactionsToExcel = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const {
    search,
    searchFields,
    offset,
    limit,
    fields,
    dateField = 'createdAt',
    ...query
  } = payload.queryStringParameters;

  const fileUrl = await transactionService.exportTransactionsToExcel({
    search,
    searchFields,
    offset,
    limit,
    fields,
    dateField,
    query,
  });

  return getResponseNoCors({
    error: 0,
    link: fileUrl,
  });
};

const getTransactions = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const {
    search,
    searchFields,
    offset,
    limit,
    fields,
    dateField = 'createdAt',
    sort,
    ...query
  } = payload.queryStringParameters;

  const { transactions, total } = await transactionService.findTransactions({
    search,
    searchFields,
    offset: parseInt(offset, 10).isNaN
      ? PAGINATION.OFFSET
      : parseInt(offset, 10),
    limit: parseInt(limit, 10).isNaN ? PAGINATION.LIMIT : parseInt(limit, 10),
    fields,
    dateField,
    sort,
    query,
  });

  return getResponseNoCors({ transactions, total, error: 0 });
};

module.exports = {
  getTransactionDetail,
  confirmTransactionByProvider,
  confirmTransactionByAdmin,
  confirmTransactionByCustomer,
  exportTransactionsToExcel,
  getTransactions,
};
