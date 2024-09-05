const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
    },
    clientId: String,
    displayName: String,
    validIAMClientIds: [String],
    slackRevenueChannel: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('Provider', providerSchema);
