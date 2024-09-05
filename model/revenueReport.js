const mongoose = require('mongoose');
const { CURRENCY_UNIT, REPORT_TYPE } = require('../constants');

const { ObjectId } = mongoose.Types;

const revenueReportSchema = new mongoose.Schema(
  {
    time: Date,
    type: {
      type: String,
      enum: Object.values(REPORT_TYPE),
    },
    customerId: String,
    revenue: Number,
    currencyUnit: {
      type: String,
      enum: Object.values(CURRENCY_UNIT),
    },
    quantity: Number,
    specificQuantity: [
      {
        _id: false,
        label: String,
        quantity: Number,
      },
    ],
    unit: String,
    totalPricedQuantity: Number,
    priceUnit: String,
    totalCalledContacts: Number,
    quantityForCostCalculation: {
      _id: false,
      quantity: Number,
      unit: String,
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

module.exports = mongoose.model('RevenueReport', revenueReportSchema);
