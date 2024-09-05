const cheerio = require('cheerio');

const { CURRENCY_EXCHANGE_RATES_URL } = require('../configs');
const callApi = require('../utils/callApi');

const convert = (price) => Number(price.replace(',', ''));

const getCurrencyExchangeRates = async () => {
  const currencyExchangeRates = [];

  const data = await callApi({
    method: 'GET',
    url: CURRENCY_EXCHANGE_RATES_URL,
  });

  const $ = cheerio.load(data, { decodeEntities: false, xmlMode: true });

  $('Exrate').each((index, element) => {
    const code = $(element).attr('CurrencyCode').trim();
    const name = $(element).attr('CurrencyName').trim();
    const buy = $(element).attr('Buy');
    const transfer = $(element).attr('Transfer');
    const sell = $(element).attr('Sell');
    if (!code || !name || !buy || !transfer || !sell) {
      throw new Error('Lacking currency exchange rate fields');
    }
    currencyExchangeRates.push({
      code,
      name,
      buy: convert(buy),
      transfer: convert(transfer),
      sell: convert(sell),
    });
  });

  return currencyExchangeRates;
};

let usdToVndRate;

const getUsdToVndRate = async () => {
  if (!usdToVndRate) {
    const currencyExchangeRates = await getCurrencyExchangeRates();
    usdToVndRate = currencyExchangeRates.find(
      (currency) => currency.code === 'USD',
    ).sell;

    return usdToVndRate;
  }

  console.log('Reuse usdToVndRate');
  return usdToVndRate;
};

module.exports = { getUsdToVndRate };
