const moment = require('moment');
const CryptoJS = require('crypto-js');
const querystring = require('qs');
const dateFormat = require('dateformat');
const { sortObject } = require('./utils');
const { TWO_CHECKOUT_STYLE } = require('../constants');

const create_payment = ({
  config,
  money,
  desc,
  request_id,
  provider,
  redirect_domain,
}) => {
  const { merchantCode, secretWord, test } = config;
  const checkoutUrl = ' https://secure.2checkout.com/checkout/buy/?';
  const requiredSignature = [
    'currency',
    'prod',
    'price',
    'type',
    'qty',
    'expiration',
    'return-url',
    'return-type',
    'description',
    'order-ext-ref',
    'item-ext-ref',
    'customer-ref',
    'customer-ext-ref',
    'opt',
    'recurrence',
    'duration',
    'renewal-price',
  ];

  const date_token = dateFormat(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
    'yyyy-mm-dd',
  );

  const params = {
    merchant: merchantCode,
    currency: 'USD',
    expiration: moment().add(15, 'minutes').unix(),
    tpl: 'default',
    style: TWO_CHECKOUT_STYLE,
    dynamic: 1,
    'return-type': 'redirect',
    'return-url': `${redirect_domain}/api/2checkout/redirect/${date_token}-${provider.name}-${request_id}`,
    prod: desc,
    price: money,
    type: 'digital',
    qty: 1,
    description: desc,
    'order-ext-ref': request_id,
    test: test ? 1 : undefined,
  };

  // generate signature
  let sigParams = {};
  requiredSignature.forEach((key) => {
    if (params[key]) sigParams[key] = params[key];
  });
  sigParams = sortObject(sigParams);
  const sourceString = Object.values(sigParams)
    .map((value) => {
      const length = Buffer.byteLength(value.toString());
      return `${length}${value}`;
    })
    .join('');
  const signature = CryptoJS.HmacSHA256(sourceString, secretWord).toString();

  const link = `${checkoutUrl}${querystring.stringify(
    params,
  )}&signature=${signature}`;

  return {
    error: 0,
    link,
    transaction_id: request_id,
  };
};

const verified_data = ({ config, query, transaction }) => {
  const { secretWord } = config;

  const { signature, ...params } = query;
  const sigParams = sortObject(params);
  Object.keys(sigParams).forEach((key) => {
    const length = Buffer.byteLength(sigParams[key].toString());
    sigParams[key] = `${length}${sigParams[key]}`;
  });

  const sourceString = Object.values(sigParams).join('');

  const mySignature = CryptoJS.HmacSHA256(sourceString, secretWord).toString();

  if (mySignature !== signature) {
    return {
      error: 1,
      error_msg: 'Invalid signature',
    };
  }

  return {
    error: 0,
    error_msg: 'Thành công',
  };
};

module.exports = {
  create_payment,
  verified_data,
};
