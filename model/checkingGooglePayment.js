const mongoose = require('mongoose');

const checkingGooglePaymentSchema = new mongoose.Schema(
  {
    googleOrderId: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('CheckingGooglePayment', checkingGooglePaymentSchema);
