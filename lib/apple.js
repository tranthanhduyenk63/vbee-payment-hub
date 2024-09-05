const { default: axios } = require('axios');
const {
  APPLE_VERIFY_RECEIPT_URL,
  APPLE_VERIFY_RECEIPT_PASSWORD,
} = require('../configs');
const logger = require('../utils/logger');

const verifyReceipt = async (receipt) => {
  try {
    const res = await axios.post(APPLE_VERIFY_RECEIPT_URL, {
      'receipt-data': receipt,
      'exclude-old-transactions': true,
      password: APPLE_VERIFY_RECEIPT_PASSWORD,
    });

    if (res.data.status !== 0) {
      logger.info(res.data, { ctx: 'VerifyReceipt' });
      return { error: 1, error_msg: res.data.status };
    }
    const receiptInfo = res.data.receipt;
    return { error: 0, data: receiptInfo };
  } catch (error) {
    logger.error(error, { ctx: 'VerifyReceipt' });
    return { error: 1, error_msg: error.message };
  }
};

const getTransactionInfoFromReceipt = (receiptInfo) => {
  const inAppTransactions = receiptInfo.in_app || [];
  inAppTransactions.sort((a, b) => b.purchase_date_ms - a.purchase_date_ms);
  const latestTransaction = inAppTransactions[0] || {};
  const {
    original_transaction_id: appleOriginalTransactionId,
    transaction_id: appleTransactionId,
  } = latestTransaction;

  return { appleOriginalTransactionId, appleTransactionId };
};

module.exports = { verifyReceipt, getTransactionInfoFromReceipt };
