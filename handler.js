/* eslint-disable no-unused-vars */
/* eslint-disable operator-linebreak */
const snakecaseKeys = require('snakecase-keys');
const dateFormat = require('dateformat');
const fetch = require('node-fetch');

const publicKeyRsaIAM = process.env.PUBLIC_KEY_IAM || null;
// const private_key = 'nf0wx1Ct6AeKAB5Rq1rmEob6QFBOH1U0eJzrQOys';//sau chia theo từng provider

const {
  list_bank_support,
  htmlDemo,
  send_post_data,
  request_hash256,
  htmlResponse,
  verified_token,
  showHtmlReturn,
} = require('./lib/utils');
const { reload_load_config } = require('./lib/config');
const vnpay = require('./lib/vnpay');
const zalopay = require('./lib/zalopay');
const momopay = require('./lib/momopay');
const paypal = require('./lib/paypal');
const twoCheckout = require('./lib/twoCheckout');
const {
  TRANSACTION_STATE,
  ROLES,
  CONFIRM_TRANSACTION_BY,
  PARTNER_NAME,
} = require('./constants');
const { executeFunc } = require('./utils/function');

const Transaction = require('./model/transaction');
const { connectToDatabase } = require('./model');

const transactionService = require('./services/transaction');
const bankController = require('./controllers/bank');
const reconcileOrderController = require('./controllers/reconcileOrder');
const authController = require('./controllers/auth');
const statsTransactionController = require('./controllers/statistic/transaction');
const statsReconcileOrderController = require('./controllers/statistic/reconcileOrder');
const configEntitiesController = require('./controllers/configEntities');
const revenueReportController = require('./controllers/revenueReport');
const revenueStatsController = require('./controllers/revenueStats');

const logger = require('./utils/logger');

const {
  bank_ipn,
  bank_hub_ipn,
  vnpay_ipn,
  momopay_ipn,
  zalopay_ipn,
  appstore_ipn,
  shopee_pay_ipn,
  twoCheckout_ipn,
  apple_ipn,
} = require('./controllers/call_ipn');

const { createPayment } = require('./controllers/create-payment');
const transactionController = require('./controllers/transaction');

async function user_redirect({ token, access_token }) {
  let jwt_customer = null;
  const jwt_info = await verified_token({ token });
  if (!jwt_info) return { error: 1, error_msg: 'Request Expire!' };
  // check key của IAM
  if (publicKeyRsaIAM && access_token) {
    jwt_customer = await verified_token({
      access_token,
      publicKeyRsa: publicKeyRsaIAM,
    });
    if (!jwt_customer) {
      return { error: 1, error_msg: 'Request Expire jwt_customer!' };
    }
  }
  const { uuid: transactionId } = jwt_info;

  const transaction = await transactionService.findTransaction({
    _id: transactionId,
  });
  if (!transaction) return { error: 1, error_msg: 'Transaction not found' };

  if (!transaction.link) return { error: 1, error_msg: 'Request Error' };
  if (transaction.redirected) {
    return {
      error: 1,
      error_msg: 'Request này đã được xử lý rồi.',
      callbackUrl: transaction.callbackUrl,
    };
  }

  return { link: transaction.link, error: 0 };
}
async function detail({ token }) {
  const jwt_info = await verified_token({ token });
  if (!jwt_info) return { error: 1, error_msg: 'Request Expire!' };
  const { uuid: transactionId } = jwt_info;
  const transaction = await transactionService.findTransaction({
    _id: transactionId,
  });
  if (!transaction) return { error: 1, error_msg: 'Transaction not found' };
  if (!transaction.link) return { error: 1, error_msg: 'Request Error' };

  transaction.error = 0;
  delete transaction.partner?.config;
  delete transaction.channel?.privateKey;
  return transaction;
}

module.exports.create = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  let response = await executeFunc(
    authController.authIAMClient,
    payload,
    ROLES.CREATE_PAYMENT,
  );
  if (response?.body?.includes('"error":1')) return response;

  response = await executeFunc(createPayment, payload, context, callback);
  connection.disconnect();
  return response;
};

async function process_redirect_from_provider({ payload, partner }) {
  logger.info(payload, { ctx: 'process_redirect_from_provider' });
  const { token } = payload.pathParameters;
  // let [year, month, day, provider, _] = token.split("-");
  // token for example: 2022-04-16-vbee-studio-467a6568-ce5d-4c05-864a-93060188bea
  const request_id = token.split('-').slice(-5).join('-');
  const query = payload.queryStringParameters;

  let transaction = await transactionService.findTransaction({
    _id: request_id,
  });
  if (!transaction) return htmlResponse({ message: 'Transaction not found ' });
  logger.info(transaction, { ctx: 'process_redirect_from_provider' });

  if (transaction.redirected) {
    return htmlResponse({
      message: 'Thanh toán không thành công, Request đã được xử lý rồi',
      link: transaction.callbackUrl,
    });
  }

  const { partner: partnerModel, channel, provider } = transaction;

  if (!channel?.name || !partnerModel?.name) {
    return htmlResponse({ message: 'Channel or partner wrong' });
  }

  const private_key = channel.privateKey;
  const { config } = partnerModel;

  const verified = await partner.verified_data({
    config,
    query,
    transaction,
  });
  if (verified.error === -1) {
    return htmlResponse({ message: JSON.stringify(verified) });
  }

  const current_state = transaction.state;
  let msg = 'Thanh toán không thành công.';
  let state_msg = 'Thất bại';
  const updatedTransactionField = { confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM };
  if (!verified.error) {
    updatedTransactionField.state = TRANSACTION_STATE.SUCCESS;
    state_msg = 'Thành công';
    msg = 'Thanh toán thành công.';
  } else {
    updatedTransactionField.state = TRANSACTION_STATE.FAILED;
  }
  if (transaction.calledIpn) {
    updatedTransactionField.state = current_state;
  }
  updatedTransactionField.redirected = true;

  transaction = await Transaction.findByIdAndUpdate(
    request_id,
    updatedTransactionField,
    {
      new: true,
    },
  );

  if (
    transaction.type === 'paypal' ||
    transaction.type === PARTNER_NAME.TWO_CHECKOUT ||
    (transaction.type === PARTNER_NAME.ZALOPAY &&
      transaction.state === TRANSACTION_STATE.FAILED)
  ) {
    // nếu là paypal thì gọi IPN
    const { money, type, bank_code, customer_id, ipn_url, state } =
      snakecaseKeys(transaction.toJSON());

    const cert = request_hash256({
      private_key,
      params: [state, money, type, bank_code, customer_id],
    });
    // update sang bên đối tác ch
    let responseFromProvider = await send_post_data({
      url: ipn_url,
      body: {
        cert,
        state,
        money,
        type,
        bank_code,
        customer_id,
        hash_text: [state, money, type, bank_code, customer_id].join('|'),
      },
    });
    responseFromProvider = JSON.stringify(responseFromProvider);
    logger.info(`responseFromProvider: ${responseFromProvider}`);
    await Transaction.findByIdAndUpdate(request_id, { responseFromProvider });
  }
  // gọi thông báo sang cho đối tác
  let callback_url = transaction.callbackUrl;
  callback_url += callback_url.indexOf('?') === -1 ? '?' : '&';
  callback_url = `${callback_url}token=${transaction.token}`;

  return htmlResponse({
    statusCode: 200,
    message: `${msg} Bạn vui lòng chờ trong giây lát.`,
    link: callback_url,
  });
}

module.exports.twoCheckout_redirect = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(process_redirect_from_provider, {
    payload,
    partner: twoCheckout,
  });
  connection.disconnect();
  return response;
};

module.exports.vnpay_redirect = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(process_redirect_from_provider, {
    payload,
    partner: vnpay,
  });
  connection.disconnect();
  return response;
};
module.exports.momopay_redirect = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(process_redirect_from_provider, {
    payload,
    partner: momopay,
  });
  connection.disconnect();
  return response;
};

module.exports.zalopay_redirect = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(process_redirect_from_provider, {
    payload,
    partner: zalopay,
  });
  connection.disconnect();
  return response;
};

module.exports.paypal_redirect = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(process_redirect_from_provider, {
    payload,
    partner: paypal,
  });
  connection.disconnect();
  return response;
};

module.exports.twoCheckout_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(
    twoCheckout_ipn,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.vnpay_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(vnpay_ipn, payload, context, callback);
  connection.disconnect();
  return response;
};

module.exports.appstore_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(appstore_ipn, payload, context, callback);
  connection.disconnect();
  return response;
};

module.exports.apple_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(apple_ipn, payload, context, callback);
  connection.disconnect();
  return response;
};

module.exports.bank_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(bank_ipn, payload, context, callback);
  connection.disconnect();
  return response;
};

module.exports.bank_hub_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(bank_hub_ipn, payload, context, callback);
  connection.disconnect();
  return response;
};

module.exports.momopay_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(momopay_ipn, payload, context, callback);
  connection.disconnect();
  return response;
};

module.exports.zalopay_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(zalopay_ipn, payload, context, callback);
  connection.disconnect();
  return response;
};

module.exports.shopee_pay_ipn = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(
    shopee_pay_ipn,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.detail = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  let response = await executeFunc(
    authController.authIAMClient,
    payload,
    ROLES.VIEW_TRANSACTION,
  );
  if (response?.body?.includes('"error":1')) return response;

  response = await executeFunc(
    transactionController.getTransactionDetail,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.user_redirect = async (payload, context, callback) => {
  const connection = await connectToDatabase();

  logger.info(payload, { ctx: 'user_redirect' });
  const { token } = payload.pathParameters;

  // TODO: handle getting access_token from keycloak user
  const info = await user_redirect({ token });
  let link = null;
  if (info.error === 0) {
    link = info.link;
  } else {
    link = info.callbackUrl;
  }

  logger.info(`user_redirect return: ${JSON.stringify(info)} - link: ${link}`, {
    ctx: 'user_redirect',
  });

  connection.disconnect();
  return htmlResponse({
    statusCode: 200,
    message: 'Bạn vui lòng chờ trong giây lát',
    link,
  });
};

module.exports.demo = async (payload, context, callback) => {
  let { partner } = payload.queryStringParameters || {};
  if (!partner) partner = 'zalopay';
  return htmlDemo();
};

module.exports.demo_provider_show = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const { token } = payload.queryStringParameters;
  const info = await detail({ token });
  let msg = 'Thanh toán thất bại';
  if (info?.state === TRANSACTION_STATE.SUCCESS) {
    msg = `Bạn vừa mua sản phẩm với giá ${info.money} thành công`;
  }
  connection.disconnect();
  return showHtmlReturn(msg);
};
module.exports.banks = async (payload, context, callback) => ({
  statusCode: 200,
  body: JSON.stringify({
    error: 0,
    list: list_bank_support.map((b) => ({
      bank_code: b[1],
      bank_name: b[2],
      bank_image: b[3],
    })),
  }),
});

module.exports.tranfer_banks = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  let response = await executeFunc(authController.authIAMClient, payload);
  if (response?.body?.includes('"error":1')) return response;

  response = await executeFunc(
    bankController.getTransferBank,
    payload,
    context,
  );
  connection.disconnect();
  return response;
};

module.exports.reload_config = async (payload, context, callback) => {
  await reload_load_config();
  return {
    statusCode: 200,
    body: JSON.stringify({ error: 0 }),
  };
};

module.exports.confirmTransactionByProvider = async (
  payload,
  context,
  callback,
) => {
  const connection = await connectToDatabase();
  let response = await executeFunc(
    authController.authIAMClient,
    payload,
    ROLES.MANAGE_TRANSACTIONS,
  );
  if (response?.body?.includes('"error":1')) return response;

  response = await executeFunc(
    transactionController.confirmTransactionByProvider,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.confirmTransactionByAdmin = async (
  payload,
  context,
  callback,
) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.MANAGE_TRANSACTIONS,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    transactionController.confirmTransactionByAdmin,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.confirmTransactionByCustomer = async (
  payload,
  context,
  callback,
) => {
  logger.info(payload, { ctx: 'confirmTransactionByCustomer' });
  const connection = await connectToDatabase();

  let response = await executeFunc(
    authController.authIAMClient,
    payload,
    ROLES.MANAGE_TRANSACTIONS,
  );
  if (response?.body?.includes('"error":1')) return response;

  response = await executeFunc(
    transactionController.confirmTransactionByCustomer,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.createRevenueReports = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'createRevenueReports' });
  const connection = await connectToDatabase();
  let response = await executeFunc(
    authController.authIAMClient,
    payload,
    ROLES.RECONCILE,
  );
  if (response?.body?.includes('"error":1')) return response;

  response = await executeFunc(
    revenueReportController.createRevenueReports,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.createReconcileOrders = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  let response = await executeFunc(
    authController.authIAMClient,
    payload,
    ROLES.RECONCILE,
  );
  if (response?.body?.includes('"error":1')) return response;

  response = await executeFunc(
    reconcileOrderController.createReconcileOrders,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.getRevenueByTransaction = async (payload, context, callback) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.VIEW_REVENUE,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    statsTransactionController.getRevenue,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.statsRevenuesByTransaction = async (
  payload,
  context,
  callback,
) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.VIEW_REVENUE,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    statsTransactionController.statsRevenues,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.statsRevenuesByReconcileOrder = async (
  payload,
  context,
  callback,
) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.VIEW_REVENUE,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    statsReconcileOrderController.statsRevenues,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.statsRevenuesByChannelByDateByReconcileOrder = async (
  payload,
  context,
  callback,
) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.VIEW_REVENUE,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    statsReconcileOrderController.statsRevenuesByChannelByDate,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.exportTransactionsToExcel = async (
  payload,
  context,
  callback,
) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.MANAGE_TRANSACTIONS,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    transactionController.exportTransactionsToExcel,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.statsRevenuesByDateByTransaction = async (
  payload,
  context,
  callback,
) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.VIEW_REVENUE,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    statsTransactionController.statsRevenuesByDate,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.exportReconcileOrdersToExcel = async (
  payload,
  context,
  callback,
) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.MANAGE_RECONCILE_ORDERS,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    reconcileOrderController.exportReconcileOrdersToExcel,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.getTransactions = async (payload, context, callback) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.MANAGE_TRANSACTIONS,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    transactionController.getTransactions,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.getReconcileOrders = async (payload, context, callback) => {
  let response = await executeFunc(
    authController.authUser,
    payload,
    ROLES.MANAGE_RECONCILE_ORDERS,
  );
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(
    reconcileOrderController.getReconcileOrders,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.notifyReconcileOrders = async (payload, context, callback) => {
  const connection = await connectToDatabase();
  const response = await executeFunc(
    reconcileOrderController.notifyReconcileOrders,
    payload,
    context,
    callback,
  );
  connection.disconnect();
  return response;
};

module.exports.notifyRevenueDaily = async (event, context, callback) => {
  const connection = await connectToDatabase();
  await executeFunc(
    revenueStatsController.notifyRevenueDaily,
    event,
    context,
    callback,
  );
  connection.disconnect();
};

module.exports.notifyProviderRevenueDaily = async (
  event,
  context,
  callback,
) => {
  const connection = await connectToDatabase();
  await executeFunc(
    revenueStatsController.notifyProviderRevenueDaily,
    event,
    context,
    callback,
  );
  connection.disconnect();
};

module.exports.notifySubRevenueDaily = async (event, context, callback) => {
  const connection = await connectToDatabase();
  await executeFunc(
    revenueStatsController.notifySubRevenueDaily,
    event,
    context,
    callback,
  );
  connection.disconnect();
};

module.exports.notifyTotalRevenueDaily = async (event, context, callback) => {
  const connection = await connectToDatabase();
  await executeFunc(
    revenueStatsController.notifyTotalRevenueDaily,
    event,
    context,
    callback,
  );
  connection.disconnect();
};

module.exports.exportRevenueReports = async (event, context, callback) => {
  const connection = await connectToDatabase();
  await executeFunc(
    revenueStatsController.exportRevenueReports,
    event,
    context,
    callback,
  );
  connection.disconnect();
};

module.exports.notifyPartnerRevenueDaily = async (event, context, callback) => {
  const connection = await connectToDatabase();
  await executeFunc(
    statsTransactionController.notifyPartnerRevenueDaily,
    event,
    context,
    callback,
  );
  connection.disconnect();
};

module.exports.getConfigEntityNames = async (payload, context, callback) => {
  let response = await executeFunc(authController.authUser, payload);
  if (response?.body?.includes('"error":1')) return response;

  const connection = await connectToDatabase();
  response = await executeFunc(configEntitiesController.getConfigEntityNames);
  connection.disconnect();
  return response;
};

// module.exports.getRecheckRevenue = async (payload, context, callback) => {
//   let response = await executeFunc(
//     authController.authUser,
//     payload,
//     ROLES.VIEW_REVENUE,
//   );
//   if (response?.body?.includes('"error":1')) return response;

//   const connection = await connectToDatabase();
//   response = await executeFunc(
//     recheckRevenueController.getRecheckRevenue,
//     payload,
//     context,
//     callback,
//   );
//   connection.disconnect();
//   return response;
// };

// module.exports.recheckRevenueDaily = async (event, context, callback) => {
//   const connection = await connectToDatabase();
//   await executeFunc(
//     recheckRevenueController.recheckRevenueDaily,
//     event,
//     context,
//     callback,
//   );
//   connection.disconnect();
// };

// module.exports.recheckRevenueMonthly = async (event, context, callback) => {
//   const connection = await connectToDatabase();
//   await executeFunc(
//     recheckRevenueController.recheckRevenueMonthly,
//     event,
//     context,
//     callback,
//   );
//   connection.disconnect();
// };

// module.exports.createCost = async (payload, context, callback) => {
//   // TODO: check permission
//   const connection = await connectToDatabase();
//   await executeFunc(costController.createCost, payload, context, callback);
//   connection.disconnect();
// };
