const Joi = require('joi');
const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');

/**
 * @param {string} payloadBody
 */
const validateConfirmation = (payloadBody) => {
  const schema = Joi.object({
    customerId: Joi.string().required(),
    code: Joi.string().required(),
    bankNumber: Joi.string().required(),
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

module.exports = { validateConfirmation };
