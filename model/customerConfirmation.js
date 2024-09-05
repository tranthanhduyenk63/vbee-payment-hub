const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

const customerConfirmationSchema = new mongoose.Schema(
  {
    customerId: String,
    bankNumber: String,
    code: String,
    provider: {
      type: ObjectId,
      ref: 'Provider',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model(
  'CustomerConfirmation',
  customerConfirmationSchema,
);
