/* eslint-disable no-unused-vars */
/* eslint-disable operator-linebreak */
/* eslint-disable prefer-const */
/* eslint-disable radix */
const snakecaseKeys = require('snakecase-keys');
const CryptoJS = require('crypto-js');
const dateFormat = require('dateformat');
const fetch = require('node-fetch');
const querystring = require('qs');
const sha256 = require('sha256');
const moment = require('moment');

// const private_key = 'nf0wx1Ct6AeKAB5Rq1rmEob6QFBOH1U0eJzrQOys';//sau chia theo từng provider

const {
  send_post_data,
  request_hash256,
  htmlResponse,
  verified_token,
  sortObject,
} = require('../lib/utils');
const vnpay = require('../lib/vnpay');
const momopay = require('../lib/momopay');
const bank = require('../lib/bank');
const appstore = require('../lib/GoogleAppleStore');
const { verified_payment_google } = require('../lib/GoogleAppleStore');
const {
  TRANSACTION_STATE,
  PARTNER_NAME,
  CONFIRM_TRANSACTION_BY,
} = require('../constants');

const Transaction = require('../model/transaction');
const CheckingGooglePayment = require('../model/checkingGooglePayment');

const transactionService = require('../services/transaction');
const CustomError = require('../errors/CustomError');

const logger = require('../utils/logger');
const { sendSlackNotification } = require('../services/notification');
const {
  FAIL_TRANSACTION_SLACK_CHANNEL,
  BANK_HUB_SECURE_TOKEN,
  IS_LOCK_APP_PAY,
  PAYMENT_HUB_V2_URL,
} = require('../configs');
const { ERROR_CODE } = require('../errors/code');
const { handleBankHubIpn } = require('../services/ipn');
const callApi = require('../utils/callApi');

module.exports.twoCheckout_ipn = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'twoCheckout' });
  const ipnData = querystring.parse(payload.body);

  const data = querystring.parse(ipnData);
  const { REFNOEXT } = data;

  let transaction = await transactionService.findTransaction({
    type: PARTNER_NAME.TWO_CHECKOUT,
    transactionId: REFNOEXT,
  });
  if (!transaction) {
    throw new CustomError(
      2,
      PARTNER_NAME.TWO_CHECKOUT,
      'Transaction not found',
    );
  }

  const { partner, channel } = transaction;
  if (!channel?.name || !partner?.name) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'error',
        message: 'channel or partner not found',
      }),
    };
  }

  // verify ipn data
  const { config } = partner;
  const { privateKey } = channel;
  const { secretKey } = config;
  const { HASH, ...sigData } = data;
  Object.keys(sigData).forEach((key) => {
    if (
      sigData[key] === '' ||
      sigData[key] === null ||
      sigData[key] === undefined
    ) {
      sigData[key] = 0;
    } else {
      const length = Buffer.byteLength(sigData[key].toString());
      sigData[key] = `${length}${sigData[key]}`;
    }
  });
  const sourceString = Object.values(sigData).join('');
  const signature = CryptoJS.HmacMD5(sourceString, secretKey).toString();

  if (signature !== HASH) {
    logger.info('signature not match', { ctx: 'twoCheckout' });
    return {
      statusCode: 200,
      body: 'invalid hash',
    };
  }

  // calculate ipn response
  const date = moment().format('YYYYMMDDHHmmss');
  const sigResponseData = {
    IPN_PID: data.IPN_PID[0],
    IPN_PNAME: data.IPN_PNAME[0],
    IPN_DATE: data.IPN_DATE,
    DATE: date,
  };
  Object.keys(sigResponseData).forEach((key) => {
    if (
      sigResponseData[key] === '' ||
      sigResponseData[key] === null ||
      sigResponseData[key] === undefined
    ) {
      sigResponseData[key] = 0;
    } else {
      const length = Buffer.byteLength(sigResponseData[key].toString());
      sigResponseData[key] = `${length}${sigResponseData[key]}`;
    }
  });
  const resSourceString = Object.values(sigResponseData).join('');
  const resSignature = CryptoJS.HmacMD5(resSourceString, secretKey).toString();

  const response = `<EPAYMENT>${date}|${resSignature}</EPAYMENT>`;

  logger.info(`response to 2checkout: ${response}`, { ctx: 'twoCheckout' });

  // update transaction
  const updateTransactionField = { confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM };
  if (
    data.ORDERSTATUS === 'COMPLETE' ||
    data.ORDERSTATUS === 'PAYMENT_AUTHORIZED'
  ) {
    logger.info(`transaction ${REFNOEXT} is completed`, { ctx: 'twoCheckout' });
    updateTransactionField.state = TRANSACTION_STATE.SUCCESS;
  } else {
    // 2checkout dont approve order
    logger.info(
      `transaction ${REFNOEXT} is not completed: ${data.ORDERSTATUS}`,
      {
        ctx: 'twoCheckout',
      },
    );
    updateTransactionField.state = TRANSACTION_STATE.FAILED;
    // send slack alert
    const messages = [
      `*Mã giao dịch: * ${REFNOEXT}`,
      `*Trạng thái từ 2checkout: * ${data.ORDERSTATUS}`,
      `*Thời gian: * ${dateFormat(new Date(), 'dd/mm/yyyy HH:MM:ss')}`,
    ];
    await sendSlackNotification({
      channel: FAIL_TRANSACTION_SLACK_CHANNEL,
      block: [
        {
          type: 'section',
          text: {
            type: 'mkrdwn',
            text: messages,
          },
        },
      ],
      text: `Giao dịch ${REFNOEXT} thất bại bởi 2checkout`,
    });
  }
  updateTransactionField.calledIpn = true;

  transaction = await Transaction.findByIdAndUpdate(
    transaction._id,
    updateTransactionField,
    {
      new: true,
    },
  );

  const { money, type, bank_code, desc, customer_id, ipn_url, state } =
    snakecaseKeys(transaction.toJSON());

  const cert = request_hash256({
    private_key: privateKey,
    params: [state, money, type, bank_code, customer_id],
  });

  // send ipn to provider
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

  await Transaction.findByIdAndUpdate(transaction._id, {
    responseFromProvider,
  });

  return {
    statusCode: 200,
    body: response,
  };
};

module.exports.vnpay_ipn = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'vnpay_ipn' });
  const storeVnpay = { ...payload.queryStringParameters };
  let vnp_Params = payload.queryStringParameters;
  try {
    let secureHash = vnp_Params.vnp_SecureHash;
    const { vnp_TransactionNo, vnp_TxnRef, vnp_ResponseCode, vnp_Amount } =
      vnp_Params;
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    vnp_Params = sortObject(vnp_Params);

    let transaction = await transactionService.findTransaction({
      vnpayId: vnp_TxnRef,
    });
    if (!transaction) {
      return {
        statusCode: 200,
        body: JSON.stringify(
          { RspCode: '01', Message: 'Transaction Not Found' },
          null,
          2,
        ),
      };
    }

    const jwt_info = await verified_token({ token: transaction.token });
    if (!jwt_info) {
      return {
        statusCode: 200,
        body: JSON.stringify(
          {
            RspCode: '02',
            Message: 'Thông tin không đúng 2',
          },
          null,
          2,
        ),
      };
    }

    const { uuid: transactionId } = jwt_info;

    const { channel, partner } = transaction;
    if (!channel?.name || !partner?.name) {
      return {
        statusCode: 200,
        body: JSON.stringify(
          {
            RspCode: '02',
            Message: 'Thông tin không đúng 3',
          },
          null,
          2,
        ),
      };
    }
    const private_key = channel.privateKey;
    const vnpayConfig = partner.config;

    logger.info(`config: ${JSON.stringify(vnpayConfig)}`, { ctx: 'vnpay_ipn' });
    const { secretKey } = partner.config;

    let signData =
      secretKey + querystring.stringify(vnp_Params, { encode: false });

    let checkSum = sha256(signData);
    logger.info(`vnpay checkSum - ${checkSum} -${secureHash}`, {
      ctx: 'vnpay_ipn',
    });

    const verified = await vnpay.verified_data({
      config: vnpayConfig,
      query: storeVnpay,
      transaction: {},
    });

    if (verified.error === 0) {
      checkSum = secureHash;
    }
    if (secureHash !== checkSum) {
      return {
        statusCode: 200,
        body: JSON.stringify(
          { RspCode: '97', Message: 'Fail checksum' },
          null,
          2,
        ),
      };
    }
    if (parseInt(`${transaction.money * 100}`) !== parseInt(`${vnp_Amount}`)) {
      return {
        statusCode: 200,
        body: JSON.stringify(
          { RspCode: '04', Message: 'Invalid amount' },
          null,
          2,
        ),
      };
    }
    if (transaction.calledIpn) {
      return {
        statusCode: 200,
        body: JSON.stringify(
          { RspCode: '02', Message: 'Transaction already confirmed' },
          null,
          2,
        ),
      };
    }

    if (secureHash === checkSum) {
      // eslint-disable-next-line max-len
      // Kiem tra du lieu co hop le khong, cap nhat trang thai don hang va gui ket qua cho VNPAY theo dinh dang duoi
      // res.status(200).json({RspCode: '00', Message: 'success'})
      // update giao dịch thành công
      const updateTransactionField = {
        confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM,
      };
      if (vnp_ResponseCode === '00') {
        updateTransactionField.state = TRANSACTION_STATE.SUCCESS;
      } else {
        updateTransactionField.state = TRANSACTION_STATE.FAILED;
      }

      updateTransactionField.calledIpn = true;

      transaction = await Transaction.findByIdAndUpdate(
        transactionId,
        updateTransactionField,
        {
          new: true,
        },
      );

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

      await Transaction.findByIdAndUpdate(transactionId, {
        responseFromProvider,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ RspCode: '00', Message: 'success' }, null, 2),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(
        { RspCode: '99', Message: 'Fail checksum' },
        null,
        2,
      ),
    };
  } catch (e) {
    logger.error(e, { ctx: 'vnpay_ipn' });
    return {
      statusCode: 200,
      body: JSON.stringify({ RspCode: '99', Message: 'Exception' }, null, 2),
    };
  }
};

module.exports.appstore_ipn = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'appstore_ipn' });
  // JSON.parse(payload.body)
  if (!payload.body) {
    throw new CustomError(2, PARTNER_NAME.APP_STORE, 'Thông tin không đúng');
  }
  const appVersion = payload.headers['app-version'];

  const query = JSON.parse(payload.body);
  // eslint-disable-next-line max-len
  // {"token":"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm92aWRlciI6ImFwcC12YmVlLXZuIiwiaWF0IjoxNjQwNzUxOTQ3LCJleHAiOjEwMjgwNjY1NTQ3fQ.DSxBwpjeecj7yvks6HPhmE71icxVOUBNKWS1t_E9dxUnKRxPIgvmPw3I6uNcI7hGrDmJW2r9_hkEkC0cNNDGdg",
  // "id_transaction":"10039",
  // "verification_data":"",
  // "source":"apple"

  // productId: 'vbee_tts_studio_adv_month',
  // eslint-disable-next-line max-len
  //   purchaseToken: `fcepdkkgjpabfjchagkpdjek.AO-J1Oyy-ttTtLJboxb3vYjU1SHY3_KFS_0xZczbK0kSVXrD9a2BLSDSMGcdATBLOih3Ok50f9lhWtDDHQydqA8TzMILl-ls0g`,
  // }

  const {
    token,
    verification_data,
    source,
    product_id,
    id_transaction,
    package_name,
  } = query;

  const isApplePay = source.indexOf('google') === -1;
  if (isApplePay && IS_LOCK_APP_PAY) return { statusCode: 200 };

  if (!appVersion) {
    // Only verify token if app does not sent app-version
    if (!token) {
      throw new CustomError(2, PARTNER_NAME.APP_STORE, 'Token không hợp lệ');
    }

    const jwt_token = await verified_token({ token });
    if (!jwt_token) {
      throw new CustomError(2, PARTNER_NAME.APP_STORE, 'Token không hợp lệ');
    }

    if (!['app-vbee-vn'].includes(jwt_token.provider)) {
      throw new CustomError(
        2,
        PARTNER_NAME.APP_STORE,
        'Token không được sử dụng cho dịch vụ này',
      );
    }
  }

  logger.info(`query ${JSON.stringify(query)}`, { ctx: 'appstore_ipn' });

  if (IS_LOCK_APP_PAY) {
    logger.info('Lock tam thanh toan', { ctx: 'appstore_ipn' });
    throw new CustomError(2, PARTNER_NAME.APP_STORE, 'Dịch vụ không tồn tại');
  }

  let error = 0;
  let transaction = {};

  if (isApplePay) {
    // Handle apple data
    const { error: appleError, info } = await appstore.verified_apple_data({
      query,
    });
    error = appleError;
    transaction = info;
  } else {
    // Handle google data
    const vCheck = await verified_payment_google({
      purchaseToken: verification_data,
      productId: product_id,
    });
    if (vCheck.error !== 0) {
      throw new CustomError(2, PARTNER_NAME.APP_STORE, 'Thông tin không đúng');
    }

    const { transactionId } = vCheck;

    const checkingGooglePayment = await CheckingGooglePayment.findOne({
      googleOrderId: transactionId,
    });

    // đã xử lý với cái product này rồi thì return luôn
    if (checkingGooglePayment) {
      throw new CustomError(
        2,
        PARTNER_NAME.APP_STORE,
        'Data này đã được xử lý rồi',
      );
    }

    // nếu chưa xử lý thì lưu lại
    await CheckingGooglePayment.create({ googleOrderId: transactionId });

    transaction = await transactionService.findTransaction({
      appstoreTransactionId: id_transaction,
    });
    if (!transaction) {
      throw new CustomError(
        -1,
        PARTNER_NAME.APP_STORE,
        `Không tồn tại giao dịch ${id_transaction}`,
      );
    }
  }

  if (error !== 0) {
    throw new CustomError(-1, PARTNER_NAME.APP_STORE, 'Thông tin không đúng 1');
  }

  const jwt_info = await verified_token({ token: transaction.token });
  if (!jwt_info) {
    throw new CustomError(-1, PARTNER_NAME.APP_STORE, 'Thông tin không đúng 2');
  }

  const { uuid: request_id, provider } = jwt_info;
  const { channel, partner, appleOriginalTransactionId, appleTransactionId } =
    transaction;
  if (!channel?.name || !partner?.name) {
    throw new CustomError(-1, PARTNER_NAME.APP_STORE, 'Thông tin không đúng 3');
  }

  const private_key = channel.privateKey;
  // update giao dịch thành công
  const updatedTransactionField = {
    confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM,
    state: TRANSACTION_STATE.SUCCESS,
    calledIpn: true,
    'additionalData.appleOriginalTransactionId': appleOriginalTransactionId,
    'additionalData.appleTransactionId': appleTransactionId,
  };
  if (!isApplePay) {
    updatedTransactionField['additionalData.purchaseToken'] = verification_data;
    updatedTransactionField['additionalData.productId'] = product_id;
    updatedTransactionField['additionalData.packageName'] = package_name;
  }

  transaction = await Transaction.findByIdAndUpdate(
    request_id,
    updatedTransactionField,
    {
      new: true,
    },
  );

  const { money, type, bank_code, customer_id, ipn_url, state } = snakecaseKeys(
    transaction.toJSON(),
  );

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

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        error: 0,
        error_msg: 'Thành Công',
      },
      null,
      2,
    ),
  };
};

module.exports.apple_ipn = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'appstore_ipn' });
  if (!payload.body) {
    throw new CustomError(2, PARTNER_NAME.APP_STORE, 'Thông tin không đúng');
  }

  // Forward to payment-hub-v2
  try {
    await callApi({
      method: 'POST',
      data: JSON.parse(payload.body),
      url: `${PAYMENT_HUB_V2_URL}/api/v1/ipn/apple`,
    });
  } catch (error) {
    logger.error(error, { ctx: 'ForwardToPaymentHubv2' });
  }

  // Verify payload authenticity
  const appleBody = JSON.parse(payload.body);
  const { error, error_msg, data } = await appstore.verified_payment_apple(
    appleBody.signedPayload,
  );
  if (error !== 0) {
    logger.error(error_msg, { ctx: 'AppleIpn' });
    throw new CustomError(2, PARTNER_NAME.APP_STORE, 'Thông tin không đúng');
  }

  logger.info(data, { ctx: 'AppleIpn' });

  if (!data) return;

  // Find corresponding transaction to update
  const {
    originalTransactionId: appleOriginalTransactionId,
    transactionId: appleTransactionId,
    appAccountToken,
  } = data;
  const transaction = await transactionService.findAppleTransactionForIPN({
    transactionId: appAccountToken,
    appleTransactionId,
  });

  if (!transaction || transaction.calledIpn) {
    logger.info('Transaction not found or is already processed', {
      ctx: 'AppleIpn',
    });
    return;
  }

  // Update transaction
  const updateTransactionField = {
    confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM,
    state: TRANSACTION_STATE.SUCCESS,
    calledIpn: true,
    'additionalData.appleOriginalTransactionId': appleOriginalTransactionId,
    'additionalData.appleTransactionId': appleTransactionId,
  };

  const updatedTransaction = await Transaction.findByIdAndUpdate(
    transaction._id,
    updateTransactionField,
    { new: true },
  );

  // Send result to provider's ipn url
  const { money, type, bank_code, customer_id, ipn_url, state } = snakecaseKeys(
    updatedTransaction.toJSON(),
  );

  const cert = request_hash256({
    private_key: transaction.channel.privateKey,
    params: [state, money, type, bank_code, customer_id],
  });
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

  await Transaction.findByIdAndUpdate(transaction._id, {
    responseFromProvider,
  });
};

module.exports.bank_ipn = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'bank_ipn' });

  if (!payload.body) {
    throw new CustomError(2, PARTNER_NAME.BANK, 'Thông tin không đúng');
  }

  const query = JSON.parse(payload.body);
  // eslint-disable-next-line max-len
  // {"query":{"sender":"techcombank","message":{"text":"TK 19033255559016\nSo tien GD:+2,490,000\nSo du:41,071,164\nAB872"}},"app":{"version":"1"},"_version":1}

  logger.info({ query }, { ctx: 'bank_ipn' });
  let {
    error,
    error_msg,
    info: transaction,
    sms_money,
  } = await bank.verified_data({ query });

  logger.info(
    `verified_data: ${JSON.stringify(
      (error, error_msg, transaction, sms_money),
    )}`,
    {
      ctx: 'bank_ipn',
    },
  );

  if (error !== 0) {
    throw new CustomError(-1, PARTNER_NAME.BANK, 'Thông tin không đúng 1');
  }

  const jwt_info = await verified_token({ token: transaction.token });
  if (!jwt_info) {
    throw new CustomError(2, PARTNER_NAME.BANK, 'Thông tin không đúng 2');
  }

  const { uuid: transactionId } = jwt_info;

  const { channel, provider, partner } = transaction;

  if (!channel?.name || !partner?.name || !provider?.name) {
    throw new CustomError(2, PARTNER_NAME.BANK, 'Thông tin không đúng 3');
  }

  if (parseInt(`${transaction.money}`) > parseInt(`${sms_money}`)) {
    throw new CustomError(2, PARTNER_NAME.BANK, 'Số tiền giao dịch không đúng');
  }

  const private_key = channel.privateKey;
  const updatedTransactionField = { confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM };
  // update giao dịch thành công
  updatedTransactionField.state = TRANSACTION_STATE.SUCCESS;
  updatedTransactionField.calledIpn = true;
  updatedTransactionField.actualMoney = sms_money;

  transaction = await Transaction.findByIdAndUpdate(
    transactionId,
    updatedTransactionField,
    {
      new: true,
    },
  );

  const { money, type, bank_code, customer_id, state, ipn_url } = snakecaseKeys(
    transaction.toJSON(),
  );

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
      actualMoney: sms_money,
      type,
      bank_code,
      customer_id,
      hash_text: [state, money, type, bank_code, customer_id].join('|'),
    },
  });
  responseFromProvider = JSON.stringify(responseFromProvider);
  logger.info(`responseFromProvider: ${responseFromProvider}`);

  await Transaction.findByIdAndUpdate(transactionId, { responseFromProvider });

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        error: 0,
        error_msg: 'Thành Công',
      },
      null,
      2,
    ),
  };
};

module.exports.bank_hub_ipn = async (payload, context, callback) => {
  logger.info({ payload }, { ctx: 'BankHubIpn' });
  if (payload.headers['Secure-Token'] !== BANK_HUB_SECURE_TOKEN) {
    throw new CustomError(401, PARTNER_NAME.BANK, 'Wrong secure-token');
  }
  if (!payload.body) {
    throw new CustomError(400, PARTNER_NAME.BANK, 'Request must have body');
  }

  const { error, data: transactions } = JSON.parse(payload.body) || {};
  if (error) {
    throw new CustomError(400, PARTNER_NAME.BANK, 'Bank hub send error');
  }

  await handleBankHubIpn(transactions);

  return { statusCode: 200, body: JSON.stringify({ success: 1 }) };
};

module.exports.momopay_ipn = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'momopay_ipn' });
  if (!payload.body) {
    throw new CustomError(2, PARTNER_NAME.MOMOPAY, 'Thông tin không đúng');
  }

  const query = JSON.parse(payload.body);
  logger.info({ query }, { ctx: 'momopay_ipn' });
  const token = query.extraData;
  const jwt_info = await verified_token({ token });
  if (!jwt_info) {
    throw new CustomError(2, PARTNER_NAME.MOMOPAY, 'Thông tin không đúng');
  }

  const { uuid: transactionId } = jwt_info;

  let transaction = await transactionService.findTransaction({
    _id: transactionId,
  });
  if (!transaction) {
    throw new CustomError(2, PARTNER_NAME.MOMOPAY, 'Transaction not found');
  }

  const { channel, partner } = transaction;
  if (!channel?.name || !partner?.name) {
    return htmlResponse({ message: 'Channel or Partner wrong' });
  }

  const private_key = channel.privateKey;
  const momoConfig = partner.config;

  const verified = await momopay.verified_data({
    config: momoConfig,
    query,
    transaction,
  });
  logger.info({ verified }, { ctx: 'momopay_ipn' });

  if (verified.error === -1) {
    throw new CustomError(0, PARTNER_NAME.MOMOPAY, 'Thông tin không đúng');
  }

  // update giao dịch thành công
  const updateTransactionField = { confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM };
  if (!verified.error) {
    updateTransactionField.state = TRANSACTION_STATE.SUCCESS;
  } else {
    updateTransactionField.state = TRANSACTION_STATE.FAILED;
  }

  updateTransactionField.calledIpn = true;

  transaction = await Transaction.findByIdAndUpdate(
    transactionId,
    updateTransactionField,
    {
      new: true,
    },
  );

  const { money, type, bank_code, customer_id, ipn_url, state } = snakecaseKeys(
    transaction.toJSON(),
  );

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

  await Transaction.findByIdAndUpdate(transactionId, { responseFromProvider });

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        returncode: 1,
        returnmessage: 'Thành công',
      },
      null,
      2,
    ),
  };
  // eslint-disable-next-line max-len
  // return htmlResponse({statusCode:200,returncode: 1, returnmessage: `Thành công`, message:`Bạn vui lòng chờ trong giây lát.` })
};

module.exports.zalopay_ipn = async (payload, context, callback) => {
  logger.info(payload, { ctx: 'zalopay_ipn' });

  if (!payload.body) {
    throw new CustomError(2, PARTNER_NAME.ZALOPAY, 'Thông tin không đúng');
  }

  const { data, mac } = JSON.parse(payload.body);
  // 1. Tách lấy token để lấy thông tin config

  const jdata = JSON.parse(data);
  const embeddata = JSON.parse(jdata.embeddata);
  logger.info({ embeddata }, { ctx: 'zalopay_ipn' });

  const { redirecturl, columninfo } = embeddata;
  const { token } = JSON.parse(columninfo);
  const jwt_info = await verified_token({ token });
  if (!jwt_info) {
    throw new CustomError(2, PARTNER_NAME.ZALOPAY, 'Thông tin không đúng');
  }

  const { uuid: transactionId } = jwt_info;

  let transaction = await transactionService.findTransaction({
    _id: transactionId,
  });
  if (!transaction) {
    throw new CustomError(2, PARTNER_NAME.ZALOPAY, 'Transaction not found');
  }

  const { channel, partner } = transaction;
  logger.info({ transaction }, { ctx: 'zalopay_ipn' });

  if (!channel?.name || !partner?.name) {
    throw new CustomError(-1, PARTNER_NAME.ZALOPAY, 'Thông tin không đúng');
  }

  const private_key = channel.privateKey;
  const zalo_config = partner.config;
  logger.info({ zalo_config }, { ctx: 'zalopay_ipn' });

  // verfied zalo info
  const dataStr = data;
  const reqMac = mac;

  const _mac = CryptoJS.HmacSHA256(dataStr, zalo_config.key2).toString();
  logger.info({ _mac }, { ctx: 'zalopay_ipn' });

  // kiểm tra callback hợp lệ (đến từ ZaloPay server)
  if (reqMac !== _mac) {
    logger.info(`Zalo pay ${reqMac} !== ${_mac}`, { ctx: 'zalopay_ipn' });
    // callback không hợp lệ
    throw new CustomError(-1, PARTNER_NAME.ZALOPAY, 'Thông tin không đúng');
  }
  // update giao dịch thành công
  const updateTransactionField = { confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM };
  updateTransactionField.state = TRANSACTION_STATE.SUCCESS;
  updateTransactionField.calledIpn = true;

  transaction = await Transaction.findByIdAndUpdate(
    transactionId,
    updateTransactionField,
    {
      new: true,
    },
  );

  const { money, type, bank_code, desc, customer_id, ipn_url, state } =
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

  await Transaction.findByIdAndUpdate(transactionId, { responseFromProvider });

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        returncode: 1,
        returnmessage: 'Thành công',
      },
      null,
      2,
    ),
  };
  // eslint-disable-next-line max-len
  // return htmlResponse({statusCode:200,returncode: 1, returnmessage: `Thành công`, message:`Bạn vui lòng chờ trong giây lát.` })
};

module.exports.shopee_pay_ipn = async (payload, context, callback) => {
  if (!payload.body) {
    throw new CustomError(2, PARTNER_NAME.SHOPEE_PAY, 'Thông tin không đúng');
  }

  logger.info(payload, { ctx: 'shopee_pay_ipn' });
  const { amount, reference_id, transaction_status } = JSON.parse(payload.body);
  const reference_ids = reference_id.split('-');
  const file_name = `${reference_ids.slice(0, 3).join('/')}/${
    reference_ids[3]
  }-${reference_ids.slice(4).join('-')}.txt`;

  const request_id = reference_ids.slice(5).join('-');
  let transaction = await transactionService.findTransaction({
    _id: request_id,
  });
  if (!transaction) {
    throw new CustomError(2, PARTNER_NAME.SHOPEE_PAY, 'Transaction not found');
  }

  const { partner, channel } = transaction;
  if (!partner?.name || !channel?.name) {
    throw new CustomError(-1, PARTNER_NAME.SHOPEE_PAY, 'Thông tin không đúng');
  }

  logger.info({ transaction }, { ctx: 'shopee_pay_ipn' });

  if (parseInt(`${transaction.money}`) * 100 !== parseInt(`${amount}`)) {
    throw new CustomError(
      2,
      PARTNER_NAME.SHOPEE_PAY,
      'Số tiền giao dịch không đúng',
    );
  }

  // update giao dịch thành công
  const updatedTransactionField = { confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM };
  if (transaction_status === 3) {
    updatedTransactionField.state = TRANSACTION_STATE.SUCCESS;
  } else {
    updatedTransactionField.state = TRANSACTION_STATE.FAILED;
  }

  updatedTransactionField.calledIpn = true;

  transaction = await Transaction.findByIdAndUpdate(
    request_id,
    updatedTransactionField,
    {
      new: true,
    },
  );

  const { money, type, bank_code, desc, customer_id, ipn_url, state } =
    snakecaseKeys(transaction.toJSON());

  const private_key = channel.privateKey;
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

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        returncode: 1,
        returnmessage: 'Thành công',
      },
      null,
      2,
    ),
  };
  // eslint-disable-next-line max-len
  // return htmlResponse({statusCode:200,returncode: 1, returnmessage: `Thành công`, message:`Bạn vui lòng chờ trong giây lát.` })
};
