const costService = require('../services/cost');
const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');

const createCost = async (payload, context, callback) => {
  if (!payload.body) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Body is empty');
  }

  const { type, product, date, money, quantity } = JSON.parse(payload.body);

  if (money !== undefined) {
    await costService.createCostMoney({ type, product, date, money });
  } else {
    await costService.createCostQuantity({ type, product, date, quantity });
  }

  return { statusCode: 200, body: JSON.stringify({ error: 0 }) };
};

module.exports = {
  createCost,
};
