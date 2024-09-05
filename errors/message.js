const { ERROR_CODE } = require('./code');

const getMessage = (code, message) => {
  switch (code) {
    case ERROR_CODE.BAD_REQUEST:
      return message || 'Bad Request';
    case ERROR_CODE.UNAUTHORIZED:
      return 'Unauthorized';
    case ERROR_CODE.FORBIDDEN:
      return 'Forbidden';
    case ERROR_CODE.NOT_FOUND:
      return 'Not Found';
    case ERROR_CODE.INTERNAL_SERVER_ERROR:
      return 'Internal server error';
    case ERROR_CODE.CONFIRMED_TRANSACTION:
      return 'Transaction has been confirmed';
    case ERROR_CODE.PUSHED_RECONCILE_ORDER:
      return 'Reconcile orders have been pushed';
    default:
      return null;
  }
};
module.exports = {
  getMessage,
};
