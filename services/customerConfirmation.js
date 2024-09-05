const CustomerConfirmation = require('../model/customerConfirmation');

const createConfirmation = async (customerConfirmation) => {
  const newConfirmation = await CustomerConfirmation.create(
    customerConfirmation,
  );
  return newConfirmation;
};

const getConfirmations = async (bankNumber) => {
  const confirmations = await CustomerConfirmation.find({ bankNumber }).lean();
  return confirmations;
};

const clearConfirmations = async (bankNumber) => {
  await CustomerConfirmation.deleteMany({ bankNumber });
};

module.exports = {
  createConfirmation,
  getConfirmations,
  clearConfirmations,
};
