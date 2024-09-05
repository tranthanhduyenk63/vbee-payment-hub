const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

const partnerSchema = new mongoose.Schema(
  {
    name: String,
    privateKey: String,
    redirectDomain: String,
    channel: {
      type: ObjectId,
      ref: 'Channel',
    },
    config: {},
    /**
     * Paypal_config: {
        mode: String,
        clientId: String,
        clientSecret: String
      }

      VNPay_config: {
        tmnCode: String,
        secretkey: String
        url: String

      }

      momo_config {
        partnerCode: String
        accessKey: String
        secretkey: String
        hostname: String
      }

      zalopay_config {
        base: String,
        app_id: String,
        key1: String,
        key2: String,
      }

      shopeepay config {
        domain: String,
        secretKey: String,
        clientId: String,
        merchantExtId: String,
        storeExtId: String,
      }
     */
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('Partner', partnerSchema);
