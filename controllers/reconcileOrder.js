const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');
const reconcileService = require('../services/reconcileOrder');
const { PAGINATION } = require('../constants');
const { getResponseNoCors } = require('../utils/function');

const createReconcileOrders = async (payload, context, callback) => {
  const { providerName } = payload;

  if (!payload.body) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Body is empty');
  }
  const { type, time, channel, reconcileOrders } = JSON.parse(payload.body);

  await reconcileService.createReconcileOrders({
    type,
    time,
    channel,
    reconcileOrders,
    providerName,
  });

  return { statusCode: 200, body: JSON.stringify({ error: 0 }) };
};

const exportReconcileOrdersToExcel = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const {
    search,
    searchFields,
    offset,
    limit,
    fields,
    sort,
    dateField = 'time',
    ...query
  } = payload.queryStringParameters;

  const fileUrl = await reconcileService.exportReconcileOrdersToExcel({
    search,
    searchFields,
    offset,
    limit,
    fields,
    sort,
    dateField,
    query,
  });

  return getResponseNoCors({
    error: 0,
    link: fileUrl,
  });
};

const getReconcileOrders = async (payload, context, callback) => {
  if (!payload.queryStringParameters) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST);
  }

  const {
    search,
    searchFields,
    offset,
    limit,
    dateField = 'time',
    sort,
    fields,
    ...query
  } = payload.queryStringParameters;

  const { reconcileOrders, total } = await reconcileService.findReconcileOrders(
    {
      search,
      searchFields,
      offset: parseInt(offset, 10).isNaN
        ? PAGINATION.OFFSET
        : parseInt(offset, 10),
      limit: parseInt(limit, 10).isNaN ? PAGINATION.LIMIT : parseInt(limit, 10),
      dateField,
      sort,
      fields,
      query,
    },
  );

  return getResponseNoCors({ reconcileOrders, total, error: 0 });
};

const notifyReconcileOrders = async (payload, context, callback) => {
  if (!payload.body) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Body is empty');
  }
  const { date, channel } = JSON.parse(payload.body);
  await reconcileService.notifyReconcileOrders({ date, channel });

  return getResponseNoCors({});
};

module.exports = {
  createReconcileOrders,
  exportReconcileOrdersToExcel,
  getReconcileOrders,
  notifyReconcileOrders,
};
