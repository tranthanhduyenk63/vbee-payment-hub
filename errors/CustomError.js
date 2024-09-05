class CustomError extends Error {
  constructor(code, partner, ...params) {
    super(...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
    this.code = code;
    this.partner = partner;
  }
}

module.exports = CustomError;
