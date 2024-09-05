const Channel = require('../model/channel');

const getChannelNames = async () => {
  const channels = await Channel.find({}).lean();
  const channelNames = channels.map(({ name }) => name);
  return channelNames;
};

module.exports = {
  getChannelNames,
};
