const mongoose = require('mongoose');
const { CONFIRM_TRANSACTION_BY, TRANSACTION_STATE } = require('../constants');

const { ObjectId } = mongoose.Types;

const transactionSchema = new mongoose.Schema(
  {
    _id: String,
    transactionId: String, // for reconcile purpose
    money: Number,
    actualMoney: Number,
    bankCode: String,
    callbackUrl: String,
    ipnUrl: String,
    desc: String,
    customerId: String,
    customer: {
      name: String,
      email: String,
      phoneNumber: String,
      identityProvider: String,
      preferredUsername: String,
    },
    type: {
      type: String,
    },
    state: Number,
    calledIpn: Boolean,
    redirected: Boolean,
    providerOrderId: String,
    telegramId: String,
    token: String,
    appTransId: String, // for ZaloPay
    appstoreTransactionId: String, // for app
    vnpayId: String, // for vnpay
    link: String,
    bank: {
      bankNumber: String,
      bankName: String,
      bankHolder: String,
      bankAddress: String,
      bankImage: String,
      code: String,
    },
    channel: {
      type: ObjectId,
      ref: 'Channel',
    },
    provider: {
      type: ObjectId,
      ref: 'Provider',
    },
    partner: {
      type: ObjectId,
      ref: 'Partner',
    },
    confirmBy: {
      type: String,
      enum: Object.values(CONFIRM_TRANSACTION_BY),
    },
    responseFromProvider: String,
    recheckState: {
      type: Number,
      default: TRANSACTION_STATE.PROCESSING,
    },
    recheckMoney: {
      type: Number,
      default: 0,
    },
    isRecheckFinal: {
      type: Boolean,
      default: false,
    },
    additionalData: {
      type: Object,
      default: {},
    },
  },
  {
    _id: false,
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('Transaction', transactionSchema);
