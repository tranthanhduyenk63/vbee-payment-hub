const Provider = require('../model/provider');

const getProviderNames = async () => {
  const providers = await Provider.find({}).lean();
  const providerNames = providers.map((item) => item.name);
  return providerNames;
};

const getProvider = async (providerName) => {
  const provider = await Provider.findOne({ name: providerName }).lean();
  return provider;
};

const getProviderByClientId = async (clientId) => {
  const provider = await Provider.findOne({ clientId }).lean();
  return provider;
};

const getProvidersHaveSlackRevenueChannel = async () => {
  const providers = await Provider.find({
    slackRevenueChannel: { $exists: true },
  }).lean();
  return providers;
};

module.exports = {
  getProviderNames,
  getProvider,
  getProviderByClientId,
  getProvidersHaveSlackRevenueChannel,
};
