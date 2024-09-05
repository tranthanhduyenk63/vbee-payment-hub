const { ERROR_CODE } = require('../errors/code');
const CustomError = require('../errors/CustomError');

/**
 * @param {JoiSchema} schema
 * @param {object} target validate target
 */
const validateObject = (target, schema) => {
  const { error } = schema.validate(target);
  if (error) {
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      null,
      error?.details?.[0]?.message || 'Validation failed',
    );
  }
};

module.exports = { validateObject };
