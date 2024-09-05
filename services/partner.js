const { PARTNER_NAME } = require('../constants');
const Partner = require('../model/partner');
const vnpay = require('../lib/vnpay');
const zalopay = require('../lib/zalopay');
const momopay = require('../lib/momopay');
const paypal = require('../lib/paypal');
const bank = require('../lib/bank');
const shopeepay = require('../lib/shopeepay');
const appstore = require('../lib/GoogleAppleStore');

const getPartnerNames = async () => {
  const partners = await Partner.aggregate([
    { $group: { _id: '$name' } },
    { $project: { name: '$_id', _id: 0 } },
  ]);

  const partnerNames = partners.map((item) => item.name);
  return partnerNames;
};

const getPartner = async (condition = {}) => {
  const partner = await Partner.findOne(condition);
  return partner;
};

const getPartnerFunc = (partnerName) => {
  switch (partnerName) {
    case PARTNER_NAME.APP_STORE:
      return appstore;
    case PARTNER_NAME.ZALOPAY:
      return zalopay;
    case PARTNER_NAME.MOMOPAY:
      return momopay;
    case PARTNER_NAME.PAYPAL:
      return paypal;
    case PARTNER_NAME.VNPAY:
      return vnpay;
    case PARTNER_NAME.BANK:
      return bank;
    case PARTNER_NAME.SHOPEE_PAY:
      return shopeepay;
    default:
      return null;
  }
};

module.exports = {
  getPartnerNames,
  getPartner,
  getPartnerFunc,
};
