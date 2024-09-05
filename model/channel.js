const mongoose = require('mongoose');

const { CHANNEL } = require('../constants');

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      enum: Object.values(CHANNEL),
      required: true,
    },
    privateKey: String,
    redirectDomain: String,
    bankPrefix: String,
    allowPushReconcileAgain: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('Channel', channelSchema);
