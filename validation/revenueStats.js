const Joi = require('joi');
const { validateObject } = require('.');

/**
 * @param {string} payloadBody
 */
const validateNotifyRevenue = (payloadBody) => {
  const schema = Joi.object({
    provider: Joi.string().required(),
    date: Joi.date().required(),
  }).required();

  validateObject(JSON.parse(payloadBody), schema);
};

module.exports = { validateNotifyRevenue };
