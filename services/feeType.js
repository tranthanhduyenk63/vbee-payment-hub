const FeeType = require('../model/feeType');

const getFeeTypes = async () => {
  const feeTypes = await FeeType.find({}).lean();
  const feeTypeNames = feeTypes.map((item) => item.name);
  return feeTypeNames;
};

module.exports = {
  getFeeTypes,
};
