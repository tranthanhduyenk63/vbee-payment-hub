const mongoose = require('mongoose');
const { COST_TYPE } = require('../constants');
const { CURRENCY_UNIT } = require('../constants');

const { ObjectId } = mongoose.Types;

const costSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(COST_TYPE),
    },
    date: Date,
    product: {
      type: ObjectId,
      ref: 'Product',
    },
    quantity: {},
    money: {
      value: {
        type: Number,
      },
      currency: {
        type: String,
        enum: Object.values(CURRENCY_UNIT),
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('Cost', costSchema);
