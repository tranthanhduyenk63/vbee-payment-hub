const { v4: uuid } = require('uuid');
const camelcaseKeys = require('camelcase-keys');
const dateFormat = require('dateformat');

const { PUBLIC_DOMAIN } = process.env;

const { gen_access_token, verified_request_hash256 } = require('../lib/utils');
const vnpay = require('../lib/vnpay');
const zalopay = require('../lib/zalopay');
const momopay = require('../lib/momopay');
const paypal = require('../lib/paypal');
const bank = require('../lib/bank');
const shopeepay = require('../lib/shopeepay');
const appstore = require('../lib/GoogleAppleStore');
const twoCheckout = require('../lib/twoCheckout');
const { TRANSACTION_STATE, PARTNER_NAME } = require('../constants');

const Provider = require('../model/provider');
const Channel = require('../model/channel');
const Partner = require('../model/partner');
const Transaction = require('../model/transaction');
const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');
const { TOKEN_EXPIRED_IN } = require('../configs');
const logger = require('../utils/logger');

const authService = require('../services/auth');

const getPartner = (partnerName) => {
  switch (partnerName) {
    case PARTNER_NAME.APP_STORE:
      return appstore;
    case PARTNER_NAME.ZALOPAY:
      return zalopay;
    case PARTNER_NAME.MOMOPAY:
      return momopay;
    case PARTNER_NAME.PAYPAL:
      return paypal;
    case PARTNER_NAME.VNPAY:
      return vnpay;
    case PARTNER_NAME.BANK:
      return bank;
    case PARTNER_NAME.SHOPEE_PAY:
      return shopeepay;
    case PARTNER_NAME.TWO_CHECKOUT:
      return twoCheckout;
    default:
      return null;
  }
};

async function create_payment({
  partner,
  channel,
  provider,
  money,
  bank_code,
  callback_url,
  desc,
  type,
  customer_id,
  partner_name,
  ipn_url,
  provider_order_id,
  customerInfo,
}) {
  const jdata = {
    money,
    bank_code,
    callback_url,
    desc,
    provider: provider._id,
    customer_id,
    ipn_url,
    type,
    customer: customerInfo,
  };
  let date = new Date();
  const aestTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  date = new Date(aestTime);
  logger.info(`Ho_Chi_Minh time: ${date.toLocaleString()}`, { ctx: 'Create' });
  const root_path = dateFormat(date, 'yyyy/mm/dd');
  // var request_date = dateFormat(date, 'yyyy-mm-dd HH:MM:ss');
  const request_id = uuid();
  jdata.state = TRANSACTION_STATE.PROCESSING;
  jdata.type = type;
  jdata.channel = channel._id;
  jdata.providerOrderId = provider_order_id || '';
  jdata.calledIpn = false;
  jdata.redirected = false;
  jdata.partner = partner._id;

  const transactionData = camelcaseKeys(jdata);
  transactionData._id = request_id;

  const transaction = await Transaction.create(transactionData);
  logger.info(
    `Created transaction in processing state: ${JSON.stringify(
      transaction.toJSON(),
    )}`,
    { ctx: 'Create' },
  );

  const token = gen_access_token({
    info: { provider: provider.name, date: root_path, uuid: request_id },
    expiresIn: type === 'bank' ? '365days' : TOKEN_EXPIRED_IN,
  });
  jdata.token = token;
  const redirect_domain = channel.redirectDomain || PUBLIC_DOMAIN;

  const partnerFunc = getPartner(partner_name);
  const {
    error,
    error_msg,
    link,
    app_trans_id,
    appstore_transaction_id,
    bank_info,
    vnpay_id,
    transaction_id,
  } = await partnerFunc.create_payment({
    config: partner.config,
    request_id,
    money,
    bank_code,
    callback_url,
    desc,
    provider,
    customer_id,
    token,
    redirect_domain,
  });

  if (error) return { error, error_msg };

  logger.info(
    {
      error,
      error_msg,
      link,
      app_trans_id,
      bank_info,
      transaction_id,
    },
    { ctx: 'Create' },
  );

  if (app_trans_id) jdata.appTransId = app_trans_id;
  if (appstore_transaction_id) {
    jdata.appstoreTransactionId = appstore_transaction_id;
  }
  if (vnpay_id) jdata.vnpayId = vnpay_id;
  if (link) jdata.link = link;
  if (bank_info?.code) {
    jdata.bank = bank_info;
  }
  if (transaction_id) jdata.transactionId = transaction_id;

  await Transaction.findByIdAndUpdate(request_id, camelcaseKeys(jdata));

  return {
    error: 0,
    token,
    link,
    request_id,
    bank_info,
    transaction_id,
  };
}

const createPayment = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'Create' });
  if (payload.source === 'serverless-plugin-warmup') {
    // await zalopay.schedule_check_transaction();
    console.log('WarmUp - Lambda is warm ok!');
    return {
      statusCode: 200,
      body: JSON.stringify({ error: -1 }),
    };
  }

  const { providerName } = payload;
  console.log('create verified: ', providerName);

  const { channel } = payload.pathParameters;
  const {
    money,
    type,
    bank_code,
    callback_url,
    desc,
    customer_id,
    ipn_url,
    cert,
    provider_order_id,
    access_token,
  } = JSON.parse(payload.body);

  const transactionMoney = Number(money);

  let customerInfo;
  if (access_token) {
    customerInfo = await authService.verifyUserToken(access_token);
    if (customerInfo?.userId !== customer_id) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        null,
        'accessToken and customerId are conflicted',
      );
    }
  }

  const providerModel = await Provider.findOne({ name: providerName });
  if (!providerModel) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Provider not found');
  }

  const channelModel = await Channel.findOne({ name: channel });
  if (!channelModel) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Channel not found');
  }

  const { privateKey } = channelModel;

  const verified_request = verified_request_hash256({
    cert,
    private_key: privateKey,
    params: [money, type, callback_url, desc, customer_id, ipn_url],
  });
  if (!verified_request) throw new CustomError(ERROR_CODE.UNAUTHORIZED);

  let partner_name = null;
  // let domain_redirect = config_channel.redirect_domain || PUBLIC_DOMAIN;
  if (
    [
      PARTNER_NAME.ZALOPAY,
      PARTNER_NAME.MOMOPAY,
      PARTNER_NAME.PAYPAL,
      PARTNER_NAME.TWO_CHECKOUT,
    ].includes(type)
  ) {
    partner_name = type;
  }
  if (['google', 'apple'].includes(type)) {
    partner_name = 'appstore';
  }
  if (['atm', 'visa'].includes(type)) {
    partner_name = 'vnpay';
  }
  if (['bank'].includes(type)) {
    partner_name = 'bank';
  }
  if (['shopeepay'].includes(type)) {
    partner_name = 'shopeepay';
  }

  if (!partner_name) throw new CustomError(ERROR_CODE.UNAUTHORIZED);

  const partnerModel = await Partner.findOne({
    name: partner_name,
    channel: channelModel._id,
  });
  if (!partnerModel) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Partner not found');
  }

  const {
    error,
    error_msg,
    token,
    link,
    // eslint-disable-next-line no-unused-vars
    request_id,
    bank_info,
    transaction_id,
  } = await create_payment({
    partner: partnerModel,
    channel: channelModel,
    provider: providerModel,
    money: transactionMoney,
    ipn_url,
    provider_order_id,
    bank_code,
    callback_url,
    desc,
    customer_id,
    partner_name,
    type,
    customerInfo,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      error,
      error_msg,
      token,
      bank_info,
      type,
      link,
      transaction_id,
    }),
  };
};

module.exports = { createPayment, create_payment };
