/* eslint-disable prefer-destructuring */
/* eslint-disable object-curly-newline */
const { PARTNER_NAME } = require('../constants');
const Bank = require('../model/bank');
const Partner = require('../model/partner');
const Provider = require('../model/provider');
const Channel = require('../model/channel');
const { connectToDatabase } = require('../model');
const { list_bank_support } = require('../lib/utils');

const { GOOGLE_SHEET_CONFIG } = process.env;

const { get_data_google_sheet } = require('../lib/utils');
const logger = require('../utils/logger');

const getPartners = (channel, channelId) => {
  const paypal = {
    config: {
      mode: channel['paypal mode'],
      clientId: channel['paypal clientId'],
      clientSecret: channel['paypal clientSecret'],
    },
    name: PARTNER_NAME.PAYPAL,
    channel: channelId,
  };
  const vnPay = {
    config: {
      tmnCode: channel.vnp_TmnCode,
      secretKey: channel.vnp_HashSecret,
      url: channel.vnp_Url,
    },
    name: PARTNER_NAME.VNPAY,
    channel: channelId,
  };
  const momoPay = {
    config: {
      partnerCode: channel['momo partnerCode'],
      accessKey: channel['momo accessKey'],
      secretKey: channel['momo serectkey'],
      hostname: channel['momo hostname'],
    },
    name: PARTNER_NAME.MOMOPAY,
    channel: channelId,
  };
  const zaloPay = {
    config: {
      base: channel['zalopay base'],
      appId: channel['zalopay app_id'],
      key1: channel['zalopay key 1'],
      key2: channel['zalopay key 2'],
    },
    name: PARTNER_NAME.ZALOPAY,
    channel: channelId,
  };

  const bank = {
    config: {
      bankPrefix: channel.bank_prefix,
    },
    name: PARTNER_NAME.BANK,
    channel: channelId,
  };

  const appstore = {
    config: {},
    name: PARTNER_NAME.APP_STORE,
    channel: channelId,
  };

  const shopeePay = {
    config: {
      domain: channel['shopeepay domain'],
      secretKey: channel['shopeepay secretKey'],
      clientId: channel['shopeepay clientId'],
      merchantExtId: channel['shopeepay merchantExtId'],
      storeExtId: channel['shopeepay storeExtId'],
    },
    name: PARTNER_NAME.SHOPEE_PAY,
    channel: channelId,
  };

  return {
    paypal,
    vnPay,
    momoPay,
    zaloPay,
    bank,
    appstore,
    shopeePay,
  };
};

const getChannels = async () => {
  const config_channel = await get_data_google_sheet({
    sheet_id: GOOGLE_SHEET_CONFIG,
    keys: {},
    sheet_index: 1,
    is_multiple: 1,
    names: [
      'redirect_domain',
      'private_key',
      'bank_prefix',
      'name',
      'paypal mode',
      'zalopay base',
      'zalopay app_id',
      'zalopay key 1',
      'zalopay key 2',
      'vnp_TmnCode',
      'vnp_HashSecret',
      'vnp_Url',
      'paypal clientId',
      'paypal clientSecret',
      'momo partnerCode',
      'momo accessKey',
      'momo serectkey',
      'momo hostname',
      'shopeepay domain',
      'shopeepay secretKey',
      'shopeepay clientId',
      'shopeepay merchantExtId',
      'shopeepay storeExtId',
    ],
  });
  if (!config_channel?.result?.results) {
    logger.info('Get Channels from Google Sheet Error', { ctx: 'Init config' });
    return;
  }
  logger.info(
    `config_channel fetched: ${JSON.stringify(config_channel.result)}`,
    {
      ctx: 'Init config',
    },
  );

  for (const channelItem of config_channel.result.results) {
    const { name, private_key, redirect_domain, bank_prefix } = channelItem;
    const channelData = {
      name,
      privateKey: private_key,
      redirectDomain: redirect_domain,
      bankPrefix: bank_prefix,
    };

    const channel = await Channel.create(channelData);
    const partnersData = getPartners(channelItem, channel._id);
    logger.info(
      { partnersData },
      {
        ctx: 'Init config',
      },
    );
    const result = await Partner.insertMany(Object.values(partnersData));
    logger.info(`Insert ${result.length} partners successfully`, {
      ctx: 'Init config',
    });
  }
};

const getBankImages = () => {
  const bankImages = {};
  list_bank_support.forEach((bank) => {
    bankImages[bank[1].toLowerCase()] = bank[3];
  });
  return bankImages;
};

const getBanks = async () => {
  const config_channel_banking = await get_data_google_sheet({
    sheet_id: GOOGLE_SHEET_CONFIG,
    keys: {},
    sheet_index: 2,
    is_multiple: 1,
    names: [
      'provider',
      'bank_number',
      'bank_name',
      'bank_holder',
      'bank_address',
    ],
  });

  if (!config_channel_banking?.result?.results) {
    logger.info('Get Banks from Google Sheet Error', { ctx: 'Init config' });
    return;
  }

  logger.info(
    `Banks fetched: ${JSON.stringify(config_channel_banking.result)}`,
    {
      ctx: 'Init config',
    },
  );
  const providers = {};
  let banks = [];
  const bankImages = getBankImages();
  for (const item of config_channel_banking.result.results) {
    if (!Object.keys(providers).includes(item.provider)) {
      const provider = await Provider.create({ name: item.provider });
      providers[item.provider] = { id: provider._id, name: provider.name };
    }

    const {
      bank_number: bankNumber,
      bank_name: bankName,
      bank_holder: bankHolder,
      bank_address: bankAddress,
    } = item;

    const bank = {
      bankNumber,
      bankName,
      bankHolder,
      bankAddress,
      bankImage: bankImages[bankName.toLowerCase()],
      provider: providers[item.provider].id,
    };
    banks = [...banks, bank];
  }

  logger.info({ banks }, { ctx: 'Init config' });
  const result = await Bank.insertMany(banks);
  logger.info(`Insert ${result.length} banks successfully`, {
    ctx: 'Init config',
  });
};

const createData = async () => {
  const connection = await connectToDatabase();
  await getChannels();
  await getBanks();
  connection.disconnect();
};

module.exports = { createData };
