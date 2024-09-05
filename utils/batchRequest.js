/**
 * This function is used to send batch requests instead of promise.all all requests
 * @param {*} func - function to be called
 * @param {*} totalParams - array of params to be called
 * @param {*} batchSize - number of func to be called at once
 * @returns - array of results
 */
const batchRequest = async (func, totalParams, batchSize) => {
  const batchPayloads = [];
  const result = [];
  for (let i = 0, n = totalParams.length; i < n; i += batchSize) {
    batchPayloads.push(totalParams.slice(i, i + batchSize));
  }
  for (let i = 0, n = batchPayloads.length; i < n; i += 1) {
    const foo = batchPayloads[i];
    const res = await Promise.all(
      foo.map(async (param) => {
        const info = await func(param);
        return info;
      }),
    );
    result.push(...res);
  }

  return result;
};

module.exports = batchRequest;
