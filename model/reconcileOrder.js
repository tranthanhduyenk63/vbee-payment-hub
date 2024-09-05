const mongoose = require('mongoose');
const {
  RECONCILE_TYPE,
  CURRENCY_UNIT,
} = require('../constants/reconcileOrder');

const { ObjectId } = mongoose.Types;

const reconcileOrderSchema = new mongoose.Schema(
  {
    money: Number,
    quantity: Number,
    numberRequest: {
      type: Number,
      default: 0,
    },
    customerId: String,
    time: Date,
    type: {
      type: String,
      enum: Object.values(RECONCILE_TYPE),
    },
    currencyUnit: {
      type: String,
      enum: Object.values(CURRENCY_UNIT),
    },
    feeType: {
      type: ObjectId,
      ref: 'FeeType',
    },
    provider: {
      type: ObjectId,
      ref: 'Provider',
    },
    channel: {
      type: ObjectId,
      ref: 'Channel',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('ReconcileOrder', reconcileOrderSchema);
