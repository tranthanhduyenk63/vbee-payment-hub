const Joi = require('joi');
const { REPORT_TYPE, CURRENCY_UNIT } = require('../constants');
const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');

/**
 * @param {string} payloadBody
 */
const validateRevenueReport = (payloadBody) => {
  const schema = Joi.object({
    type: Joi.string()
      .valid(...Object.values(REPORT_TYPE))
      .required(),
    time: Joi.date().required(),
    channel: Joi.string().required(),
    provider: Joi.string().required(),
    userReport: Joi.object({
      totalNewUsers: Joi.number(),
      totalSwitchUsers: Joi.number(),
    }),
    revenueReports: Joi.array().items(
      Joi.object({
        customerId: Joi.string().required(),
        revenue: Joi.number().required(),
        currencyUnit: Joi.string()
          .valid(...Object.values(CURRENCY_UNIT))
          .required(),
        quantity: Joi.number().required(),
        unit: Joi.string().required(),
        feeType: Joi.string().required(),
        specificQuantity: Joi.array().items(
          Joi.object({
            label: Joi.string().required(),
            quantity: Joi.number().required(),
          }),
        ),
        totalPricedQuantity: Joi.number(),
        priceUnit: Joi.string(),
        totalCalledContacts: Joi.number(),
        quantityForCostCalculation: Joi.object({
          quantity: Joi.number().required(),
          unit: Joi.string().required(),
        }),
        totalBlock30s: Joi.number(),
      }),
    ),
  }).required();

  const { error } = schema.validate(JSON.parse(payloadBody));
  if (error) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      error?.details?.[0]?.message || 'Validation failed',
    );
  }
};

module.exports = { validateRevenueReport };
