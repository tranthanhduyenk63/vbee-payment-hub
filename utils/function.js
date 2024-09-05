const { getErrorResponse } = require('../errors/errorHandler');

const executeFunc = async (func, ...args) => {
  let response;
  try {
    response = await func(...args);
  } catch (error) {
    response = getErrorResponse(error);
  }
  return response;
};

const getResponseNoCors = (body) => ({
  statusCode: 200,
  body: JSON.stringify(body),
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
});

module.exports = { executeFunc, getResponseNoCors };
