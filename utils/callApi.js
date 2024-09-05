const axios = require('axios');
const camelCaseKeys = require('camelcase-keys');
const uuid = require('uuid');
const logger = require('./logger');

const axiosInstance = axios.create({
  responseType: 'json',
  timeout: 10 * 1000,
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Do something before request is sent
    config.id = uuid.v4();
    const originalUrl = config.baseURL
      ? `${config.baseURL}${config.url}`
      : config.url;
    logger.info(
      `[${config.id}] ${config.method.toUpperCase()} - ${originalUrl}`,
      { ctx: 'callApi.req' },
    );
    return config;
  },
  (error) =>
    // Do something with request error
    // eslint-disable-next-line implicit-arrow-linebreak
    Promise.reject(error),
);

// Add a response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    const blackList = [];
    const { config } = response;
    const originalUrl = config.baseURL
      ? `${config.baseURL}${config.url}`
      : config.url;
    const isShowData = !blackList.includes(
      `${response.config.method.toUpperCase()} - ${originalUrl}`,
    );
    logger.info(
      `[${response.config.id}] ${
        isShowData ? JSON.stringify(response.data) : ''
      }`,
      { ctx: 'callApi.res.success' },
    );
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    return camelCaseKeys(response.data, { deep: true });
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    const { config, response, message } = error;

    if (response) {
      const { data } = response;
      const isShowData = !(
        data &&
        typeof data === 'string' &&
        data.match('<!DOCTYPE html>')
      );
      logger.error(
        `[${config.id}] ${
          data && isShowData ? JSON.stringify(response.data) : ''
        }`,
        { ctx: 'callApi.res.error' },
      );
    } else {
      logger.error(`[${config.id}] ${message}`, { ctx: 'callApi.res.error' });
    }

    return Promise.reject(error);
  },
);

module.exports = axiosInstance;
