const snakecaseKeys = require('snakecase-keys');

const {
  request_hash256,
  verified_token,
  send_post_data,
} = require('../lib/utils');
const Channel = require('../model/channel');
const Transaction = require('../model/transaction');
const logger = require('../utils/logger');
const {
  TRANSACTION_STATE,
  CONFIRM_TRANSACTION_BY,
  PARTNER_NAME,
} = require('../constants');
const CustomError = require('../errors/CustomError');
const { ERROR_CODE } = require('../errors/code');

const sendIpnToProvider = async (transaction, privateKey) => {
  const { money, type, bank_code, customer_id, state, ipn_url, actual_money } =
    snakecaseKeys(transaction);

  const cert = request_hash256({
    private_key: privateKey,
    params: [state, money, type, bank_code, customer_id],
  });

  const responseFromProvider = await send_post_data({
    url: ipn_url,
    body: {
      cert,
      state,
      money,
      actualMoney: actual_money,
      type,
      bank_code,
      customer_id,
      hash_text: [state, money, type, bank_code, customer_id].join('|'),
    },
  });

  logger.info(
    `response from provider: ${JSON.stringify(responseFromProvider)}`,
    {
      ctx: 'HandleBankHubIpn',
    },
  );
  return responseFromProvider;
};

const findTransactionFromBankDescription = async (description, bankPrefix) => {
  const regexp = new RegExp(`${bankPrefix}[0-9]+`, 'gi');
  const bankPrefixRegexp = new RegExp(`\\b${bankPrefix}`, 'gi');

  const m = description.match(regexp);
  if (!m || m.length <= 0) {
    logger.error(
      `Description does not match bankPrefix: ${JSON.stringify({
        description,
        bankPrefix,
      })}`,
      { ctx: 'HandleBankHubIpn' },
    );
    return null;
  }

  const bankCode = m[0].replace(bankPrefixRegexp, bankPrefix);
  const transaction = await Transaction.findOne({
    'bank.code': bankCode,
  }).lean();

  return transaction;
};

const handleBankHubTransaction = async (bankHubTransaction, channels) => {
  logger.info({ bankHubTransaction }, { ctx: 'HandleBankHubIpn' });
  try {
    const { description, amount, id: bankHubId } = bankHubTransaction;

    const channel = channels.find((item) => {
      const { bankPrefix } = item;
      if (!bankPrefix) return false;
      if (description.toLowerCase().indexOf(bankPrefix.toLowerCase()) !== -1) {
        return true;
      }
      return false;
    });
    if (!channel || !channel.bankPrefix) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        PARTNER_NAME.BANK,
        'Cannot find channel',
      );
    }

    const { bankPrefix, privateKey } = channel;
    const transaction = await findTransactionFromBankDescription(
      description,
      bankPrefix,
    );
    if (!transaction) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        PARTNER_NAME.BANK,
        'Cannot find transaction',
      );
    }

    const { state, money: transactionPrice, token } = transaction;
    if (state === TRANSACTION_STATE.SUCCESS) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        PARTNER_NAME.BANK,
        `Transaction ${bankHubId} is already processed`,
      );
    }
    if (amount < transactionPrice) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        PARTNER_NAME.BANK,
        `Transaction ${bankHubId} does not send enough money`,
      );
    }
    const jwtInfo = await verified_token({ token });
    if (!jwtInfo) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        PARTNER_NAME.BANK,
        `Token of transaction ${bankHubId} invalid`,
      );
    }
    const { uuid: transactionId } = jwtInfo;
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      {
        state: TRANSACTION_STATE.SUCCESS,
        calledIpn: true,
        actualMoney: amount,
        confirmBy: CONFIRM_TRANSACTION_BY.SYSTEM,
      },
      {
        new: true,
      },
    ).lean();

    const responseFromProvider = await sendIpnToProvider(
      updatedTransaction,
      privateKey,
    );
    await Transaction.findByIdAndUpdate(transactionId, {
      responseFromProvider: JSON.stringify(responseFromProvider),
    });
  } catch (error) {
    logger.error(`Error when handle transaction ${bankHubTransaction.id}`, {
      ctx: 'HandleBankHubIpn',
      stack: error.stack,
    });
  }
};

const handleBankHubIpn = async (transactions) => {
  const channels = await Channel.find({}).lean();

  await Promise.all(
    transactions.map(async (transaction) => {
      await handleBankHubTransaction(transaction, channels);
    }),
  );
};

module.exports = { handleBankHubIpn };
