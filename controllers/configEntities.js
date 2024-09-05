const providerService = require('../services/provider');
const partnerService = require('../services/partner');
const channelService = require('../services/channel');
const feeTypeService = require('../services/feeType');
const { getResponseNoCors } = require('../utils/function');

const getConfigEntityNames = async () => {
  const [providers, partners, channels, feeTypes] = await Promise.all([
    providerService.getProviderNames(),
    partnerService.getPartnerNames(),
    channelService.getChannelNames(),
    feeTypeService.getFeeTypes(),
  ]);

  return getResponseNoCors({ providers, channels, partners, feeTypes });
};

module.exports = { getConfigEntityNames };
