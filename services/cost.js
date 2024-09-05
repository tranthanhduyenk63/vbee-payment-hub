const moment = require('moment');
const { COST_TYPE, CURRENCY_UNIT } = require('../constants');
const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');
const Cost = require('../model/cost');
const Product = require('../model/product');
const logger = require('../utils/logger');

const createCostMoney = async ({ type, product, date, money }) => {
  logger.info(
    `create cost money: ${JSON.stringify({
      type,
      product,
      date,
      money,
    })}`,
    { ctx: 'createCostMoney' },
  );

  if (!type || !product || !date || !money || !money.value || !money.currency) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Missing type or product name or date or money',
    );
  }

  if (!Object.values(CURRENCY_UNIT).includes(money.currency)) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Invalid currency unit',
    );
  }

  const productModel = await Product.findOne({ name: product });
  if (!productModel) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Product not found');
  }

  let costDate;
  switch (type) {
    case COST_TYPE.DAY:
      costDate = moment(date).endOf('day').toISOString();
      break;
    case COST_TYPE.WEEK:
      costDate = moment(date).endOf('week').toISOString();
      break;
    case COST_TYPE.MONTH:
      costDate = moment(date).endOf('month').toISOString();
      break;
    default:
      throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Type invalid');
  }
  const cost = await Cost.findOne({
    type,
    product: productModel._id,
    date: costDate,
  });

  if (!cost) {
    await Cost.create({
      type,
      product: productModel._id,
      date: costDate,
      money,
    });
  } else {
    if (cost.money !== undefined) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        null,
        'Money is already set',
      );
    }
    await Cost.updateOne({ _id: cost._id }, { money });
  }
};

const createCostQuantity = async ({ type, product, date, quantity }) => {
  logger.info(
    `create cost quantity: ${JSON.stringify({
      type,
      product,
      date,
      quantity,
    })}`,
    { ctx: 'createCostQuantity' },
  );

  if (
    !type ||
    !product ||
    !date ||
    !quantity ||
    Object.keys(quantity).length === 0
  ) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      'Missing type or product name or date or quantity',
    );
  }

  Object.values(quantity).forEach((value) => {
    if (Number.isNaN(value)) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        null,
        'Quantity value must be number',
      );
    }
  });

  const productModel = await Product.findOne({ name: product });
  if (!productModel) {
    throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Product not found');
  }

  let costDate;
  switch (type) {
    case COST_TYPE.DAY:
      costDate = moment(date).endOf('day').toISOString();
      break;
    case COST_TYPE.WEEK:
      costDate = moment(date).endOf('week').toISOString();
      break;
    case COST_TYPE.MONTH:
      costDate = moment(date).endOf('month').toISOString();
      break;
    default:
      throw new CustomError(ERROR_CODE.BAD_REQUEST, null, 'Type invalid');
  }
  const cost = await Cost.findOne({
    type,
    product: productModel._id,
    date: costDate,
  });

  if (!cost) {
    await Cost.create({
      type,
      product: productModel._id,
      date: costDate,
      quantity,
    });
  } else {
    if (cost.quantity !== undefined) {
      throw new CustomError(
        ERROR_CODE.BAD_REQUEST,
        null,
        'Quantity is already set',
      );
    }
    await Cost.updateOne({ _id: cost._id }, { quantity });
  }
};

module.exports = {
  createCostMoney,
  createCostQuantity,
};
