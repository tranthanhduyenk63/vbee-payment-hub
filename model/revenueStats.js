const mongoose = require('mongoose');
const { VBEE_PRODUCT, CURRENCY_UNIT } = require('../constants');

const revenueStatsSchema = new mongoose.Schema(
  {
    time: Date,
    product: { type: String, enum: Object.values(VBEE_PRODUCT) },
    label: String,
    revenue: Number,
    currencyUnit: { type: String, enum: Object.values(CURRENCY_UNIT) },
    totalQuantity: Number, // total quantity by charge unit (both internal and external)
    chargeQuantity: Number, // only charged quantity (external)
    chargeUnit: String,
    totalCalledContacts: Number,
    unit: String, // unit for specific quantity
    specificQuantity: [
      {
        _id: false,
        label: String,
        quantity: Number,
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('RevenueStats', revenueStatsSchema);
