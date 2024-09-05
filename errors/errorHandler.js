const { PARTNER_NAME } = require('../constants');
const { ERROR_CODE } = require('./code');
const { getMessage } = require('./message');

const getErrorResponse = (error) => {
  const message = error?.message;
  const code = error?.code;
  const partner = error?.partner;

  const error_msg = getMessage(code, message) || message;
  error.message = error_msg;

  console.error('Error: ', error);

  let errorBody = {};
  switch (partner) {
    case PARTNER_NAME.VNPAY:
      errorBody = { RspCode: code || '99', Message: message || 'Exception' };
      break;
    case PARTNER_NAME.MOMOPAY:
      errorBody = { returncode: code || -1, returnmessage: message };
      break;
    case PARTNER_NAME.ZALOPAY:
      errorBody = { returncode: code || -1, returnmessage: message };
      break;
    case PARTNER_NAME.SHOPEE_PAY:
      errorBody = { returncode: code || -1, returnmessage: message };
      break;
    default:
      errorBody = {
        error: 1,
        code: code || ERROR_CODE.INTERNAL_SERVER_ERROR,
        error_msg,
      };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(errorBody),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};

module.exports = { getErrorResponse };
