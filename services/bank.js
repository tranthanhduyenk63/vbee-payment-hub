const { default: axios } = require('axios');
const Provider = require('../model/provider');
const Bank = require('../model/bank');
const { BANK_HUB_API_KEY } = require('../configs');
const logger = require('../utils/logger');
const { clearConfirmations } = require('./customerConfirmation');

const getTransferBank = async (providerName) => {
  const providerModel = await Provider.findOne({ name: providerName });
  if (!providerModel) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: 1, error_msg: 'Provider not found' }),
    };
  }

  const banks = await Bank.find({ provider: providerModel._id }).lean();

  return banks;
};

const getBank = async (condition) => {
  const bank = await Bank.findOne(condition);
  return bank;
};

const updateBankSyncData = async ({ bankNumber, isSyncHolding, syncTime }) => {
  await Bank.updateMany(
    { bankNumber },
    { isSyncHolding, lastSyncTime: syncTime },
  );
};

const forceSyncBank = async (bankNumber) => {
  logger.info(`start force sync bank ${bankNumber}`, { ctx: 'ForceSyncBank' });
  try {
    await updateBankSyncData({
      bankNumber,
      isSyncHolding: false,
      syncTime: new Date(),
    });
    const response = await axios({
      method: 'post',
      url: 'https://oauth.casso.vn/v2/sync',
      headers: {
        Authorization: `Apikey ${BANK_HUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ bank_acc_id: bankNumber }),
    });

    logger.info(response.data, { ctx: 'ForceSyncBank' });
    await clearConfirmations(bankNumber);
  } catch (error) {
    console.error(`Error when force sync bank ${bankNumber}`, error);
  }
};

module.exports = {
  getTransferBank,
  getBank,
  updateBankSyncData,
  forceSyncBank,
};
