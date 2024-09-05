const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

const bankSchema = new mongoose.Schema(
  {
    bankNumber: String,
    bankName: String,
    bankHolder: String,
    bankAddress: String,
    bankImage: String,
    provider: {
      type: ObjectId,
      ref: 'Provider',
    },
    lastSyncTime: Date,
    isSyncHolding: Boolean,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('Bank', bankSchema);
