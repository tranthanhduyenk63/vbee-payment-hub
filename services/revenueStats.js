/* eslint-disable max-len */
const moment = require('moment');
const {
  REVENUE_SUB_SLACK_CHANNEL,
  REVENUE_SME_SLACK_CHANNEL,
  REVENUE_ALL_SLACK_CHANNEL,
  REVENUE_REPORTS_SHEET_ID,
  REVENUE_REPORTS_SHEET_NAME,
} = require('../configs');
const {
  sendProviderRevenueSlackNoti,
  sendSubRevenueSlackNoti,
  sendSmeRevenueSlackNoti,
  sendTotalRevenueSlackNoti,
} = require('./notification/slack');
const {
  getProviderNames,
  getProvidersHaveSlackRevenueChannel,
} = require('./provider');
const {
  getExpectedDateRevenue,
  getExpectedMonthRevenue,
  getExpectedYearRevenue,
} = require('./revenueReport');
const {
  VBEE_PRODUCT,
  PAY_TYPE,
  VBEE_SUB_PRODUCTS,
  REPORT_TYPE,
  PAY_TYPE_VIETNAMESE,
  VBEE_PRODUCT_VIETNAMESE,
} = require('../constants');
const { findRevenueReports } = require('../daos/revenueReport');
const {
  createRevenueStats,
  deleteManyRevenueStats,
} = require('../daos/revenueStats');
const sheetService = require('./googleapis/sheet');
const { convertToProduct } = require('./vbeeLabels');

/* eslint-disable prettier/prettier */
const mergeSubProducts = (subProducts = [], isTotal = false) => {
  const mergedSubProducts = [];
  const remainingSubProducts = Object.values(VBEE_SUB_PRODUCTS);

  subProducts.forEach((subProduct) => {
    const subProductIndex = remainingSubProducts.indexOf(subProduct.product);
    if (subProductIndex !== -1) remainingSubProducts.splice(subProductIndex, 1);

    const existedSubProduct = mergedSubProducts.find((item) => item.product === subProduct.product);
    if (!existedSubProduct) mergedSubProducts.push(subProduct);
    else {
      existedSubProduct.revenue += subProduct.revenue;
      existedSubProduct.quantity += subProduct.quantity;
      existedSubProduct.totalPricedQuantity += subProduct.totalPricedQuantity;
      existedSubProduct.totalCalledContacts += subProduct.totalCalledContacts;
      subProduct.specificQuantity?.forEach(({ label, quantity }) => {
        const quantityItem = existedSubProduct.specificQuantity.find((item) => item.label === label);
        if (!quantityItem) existedSubProduct.specificQuantity.push({ label, quantity });
        else quantityItem.quantity += quantity;
      });
    }
  });

  if (isTotal) remainingSubProducts.forEach((subProduct) => mergedSubProducts.push({ product: subProduct, revenue: 0 }));

  const result = isTotal ? Object.values(VBEE_PRODUCT).map((product) => ({ product, revenue: 0, subProducts: [] })) : [];

  mergedSubProducts.forEach((subProduct) => {
    const { product } = subProduct;
    const parentProductName = Object.values(VBEE_PRODUCT).find((vbeeProduct) => product.includes(vbeeProduct));
    if (!parentProductName) return;

    let parentProduct = result.find((item) => item.product === parentProductName);
    if (!parentProduct) {
      parentProduct = { product: parentProductName, revenue: 0, subProducts: [] };
      result.push(parentProduct);
    }

    parentProduct.revenue += subProduct.revenue;
    parentProduct.subProducts.push(subProduct);
  });

  return result;
};
/* eslint-disable prettier/prettier */

const saveRevenuesToRevenueStats = async (revenues, date) => {
  const revenuesStats = [];

  revenues.forEach((item) => {
    const { product, subProducts } = item;

    subProducts.forEach((subProduct) => {
      const {
        product: label, revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit
      } = subProduct;

      const revenueStatsItem = {
        time: moment(date).utcOffset(7).endOf('day'),
        product,
        label,
        revenue,
        currencyUnit,
        totalQuantity: totalPricedQuantity || quantity,
        chargeQuantity: quantity,
        chargeUnit: priceUnit || unit,
        totalCalledContacts,
        unit,
        specificQuantity,
      };

      revenuesStats.push(revenueStatsItem);
    });
  });

  await deleteManyRevenueStats({ time: moment(date).utcOffset(7).endOf('day') });
  await createRevenueStats(revenuesStats);
};

const notifyOneProviderRevenue = async (provider, date) => {
  const providerName = provider.name;

  const paygRevenue = await getExpectedDateRevenue(providerName, date);
  const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

  const datePaygRevenues = [];
  Object.values(VBEE_PRODUCT).forEach((feeType) => {
    if (revenue[feeType] || quantity[feeType] || totalPricedQuantity[feeType] || totalCalledContacts[feeType]) {
      const productLabel = convertToProduct(providerName, PAY_TYPE.PAYG, feeType);
      const paygSpecificQuantity = [];
      Object.keys(specificQuantity).forEach((key) => {
        if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
      });
      datePaygRevenues.push({
        product: productLabel,
        revenue: revenue[feeType],
        quantity: quantity[feeType],
        totalCalledContacts: totalCalledContacts[feeType],
        totalPricedQuantity: totalPricedQuantity[feeType],
        priceUnit: priceUnit[feeType],
        specificQuantity: paygSpecificQuantity,
        currencyUnit,
        unit,
      });
    }
  });

  const monthPaygRevenue = await getExpectedMonthRevenue(providerName, date);
  const {
    revenue: monthRevenue,
    quantity: monthQuantity,
    specificQuantity: monthSpecific,
    totalCalledContacts: monthTotalCalled,
    totalPricedQuantity: monthTotalPriced,
    priceUnit: monthPriceUnit,
    currencyUnit: monthCurrency,
    unit: monthUnit,
  } = monthPaygRevenue;

  const monthPaygRevenues = [];
  Object.values(VBEE_PRODUCT).forEach((feeType) => {
    if (monthRevenue[feeType] || monthQuantity[feeType]) {
      const productLabel = convertToProduct(providerName, PAY_TYPE.PAYG, feeType);
      const paygSpecificQuantity = [];
      Object.keys(monthSpecific).forEach((key) => {
        if (monthSpecific[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: monthSpecific[key][feeType] });
      });
      monthPaygRevenues.push({
        product: productLabel,
        revenue: monthRevenue[feeType],
        quantity: monthQuantity[feeType],
        totalCalledContacts: monthTotalCalled[feeType],
        totalPricedQuantity: monthTotalPriced[feeType],
        priceUnit: monthPriceUnit[feeType],
        specificQuantity: paygSpecificQuantity,
        currencyUnit: monthCurrency,
        unit: monthUnit,
      });
    }
  });

  const dateRevenues = mergeSubProducts(datePaygRevenues);
  const monthRevenues = mergeSubProducts(monthPaygRevenues);

  await sendProviderRevenueSlackNoti(provider.slackRevenueChannel, {
    date,
    dateRevenues,
    monthRevenues,
    displayName: provider.displayName,
  });
};

const notifyProviderRevenue = async (date) => {
  const providers = await getProvidersHaveSlackRevenueChannel();
  await Promise.all(providers.map((provider) => notifyOneProviderRevenue(provider, date)));
};

const notifySubscriptionRevenue = async (date) => {
  const providerNames = await getProviderNames();

  const datePaygRevenue = await Promise.all(
    providerNames.map(async (providerName) => {
      const paygRevenue = await getExpectedDateRevenue(providerName, date);
      const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

      const paygRevenues = [];
      Object.values(VBEE_PRODUCT).forEach((feeType) => {
        if (revenue[feeType] || quantity[feeType] || totalPricedQuantity[feeType] || totalCalledContacts[feeType]) {
          const productLabel = convertToProduct(providerName, PAY_TYPE.PAYG, feeType);
          if (!productLabel.includes('Sub')) return;

          const paygSpecificQuantity = [];
          Object.keys(specificQuantity).forEach((key) => {
            if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
          });
          paygRevenues.push({
            product: productLabel,
            revenue: revenue[feeType],
            quantity: quantity[feeType],
            totalCalledContacts: totalCalledContacts[feeType],
            totalPricedQuantity: totalPricedQuantity[feeType],
            priceUnit: priceUnit[feeType],
            specificQuantity: paygSpecificQuantity,
            currencyUnit,
            unit,
          });
        }
      });

      return paygRevenues;
    }),
  );
  const monthPaygRevenue = await Promise.all(
    providerNames.map(async (providerName) => {
      const paygRevenue = await getExpectedMonthRevenue(providerName, date);
      const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

      const paygRevenues = [];
      Object.values(VBEE_PRODUCT).forEach((feeType) => {
        if (revenue[feeType] || quantity[feeType] || totalPricedQuantity[feeType] || totalCalledContacts[feeType]) {
          const productLabel = convertToProduct(providerName, PAY_TYPE.PAYG, feeType);
          if (!productLabel.includes('Sub')) return;

          const paygSpecificQuantity = [];
          Object.keys(specificQuantity).forEach((key) => {
            if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
          });
          paygRevenues.push({
            product: productLabel,
            revenue: revenue[feeType],
            quantity: quantity[feeType],
            totalCalledContacts: totalCalledContacts[feeType],
            totalPricedQuantity: totalPricedQuantity[feeType],
            priceUnit: priceUnit[feeType],
            specificQuantity: paygSpecificQuantity,
            currencyUnit,
            unit,
          });
        }
      });

      return paygRevenues;
    }),
  );

  const dateRevenues = mergeSubProducts(datePaygRevenue.flat());
  const monthRevenues = mergeSubProducts(monthPaygRevenue.flat());

  await sendSubRevenueSlackNoti(REVENUE_SUB_SLACK_CHANNEL, {
    date,
    dateRevenues,
    monthRevenues,
  });
};

const notifySmeRevenue = async (date) => {
  const providerNames = await getProviderNames();

  const datePaygRevenue = await Promise.all(
    providerNames.map(async (providerName) => {
      const paygRevenue = await getExpectedDateRevenue(providerName, date);
      const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

      const paygRevenues = [];
      Object.values(VBEE_PRODUCT).forEach((feeType) => {
        if (revenue[feeType] || quantity[feeType] || totalPricedQuantity[feeType] || totalCalledContacts[feeType]) {
          const productLabel = convertToProduct(providerName, PAY_TYPE.PAYG, feeType);
          if (!productLabel.includes('SME')) return;

          const paygSpecificQuantity = [];
          Object.keys(specificQuantity).forEach((key) => {
            if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
          });
          paygRevenues.push({
            product: productLabel,
            revenue: revenue[feeType],
            quantity: quantity[feeType],
            totalCalledContacts: totalCalledContacts[feeType],
            totalPricedQuantity: totalPricedQuantity[feeType],
            priceUnit: priceUnit[feeType],
            specificQuantity: paygSpecificQuantity,
            currencyUnit,
            unit,
          });
        }
      });

      return paygRevenues;
    }),
  );
  const monthPaygRevenue = await Promise.all(
    providerNames.map(async (providerName) => {
      const paygRevenue = await getExpectedMonthRevenue(providerName, date);
      const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

      const paygRevenues = [];
      Object.values(VBEE_PRODUCT).forEach((feeType) => {
        if (revenue[feeType] || quantity[feeType] || totalPricedQuantity[feeType] || totalCalledContacts[feeType]) {
          const productLabel = convertToProduct(providerName, PAY_TYPE.PAYG, feeType);
          if (!productLabel.includes('SME')) return;

          const paygSpecificQuantity = [];
          Object.keys(specificQuantity).forEach((key) => {
            if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
          });
          paygRevenues.push({
            product: productLabel,
            revenue: revenue[feeType],
            quantity: quantity[feeType],
            totalCalledContacts: totalCalledContacts[feeType],
            totalPricedQuantity: totalPricedQuantity[feeType],
            priceUnit: priceUnit[feeType],
            specificQuantity: paygSpecificQuantity,
            currencyUnit,
            unit,
          });
        }
      });

      return paygRevenues;
    }),
  );

  const dateRevenues = mergeSubProducts(datePaygRevenue.flat());
  const monthRevenues = mergeSubProducts(monthPaygRevenue.flat());

  await sendSmeRevenueSlackNoti(REVENUE_SME_SLACK_CHANNEL, {
    date,
    dateRevenues,
    monthRevenues,
  });
};

/* eslint-disable prettier/prettier */
const notifyTotalRevenue = async (date) => {
  // const usdToVndRate = await getUsdToVndRate();
  const providerNames = await getProviderNames();

  // [ { product, revenue, quantity, specificQuantity, currencyUnit, unit } ]
  const datePaygRevenue = await Promise.all(
    providerNames.map(async (providerName) => {
      const paygRevenue = await getExpectedDateRevenue(providerName, date);
      const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

      const paygRevenues = [];
      Object.values(VBEE_PRODUCT).forEach((feeType) => {
        if (revenue[feeType] || quantity[feeType]) {
          const paygSpecificQuantity = [];
          Object.keys(specificQuantity).forEach((key) => {
            if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
          });
          paygRevenues.push({
            product: convertToProduct(providerName, PAY_TYPE.PAYG, feeType),
            revenue: revenue[feeType],
            quantity: quantity[feeType],
            totalCalledContacts: totalCalledContacts[feeType],
            totalPricedQuantity: totalPricedQuantity[feeType],
            priceUnit: priceUnit[feeType],
            specificQuantity: paygSpecificQuantity,
            currencyUnit,
            unit,
          });
        }
      });

      return paygRevenues;
    }),
  );
  const monthPaygRevenue = await Promise.all(
    providerNames.map(async (providerName) => {
      const paygRevenue = await getExpectedMonthRevenue(providerName, date);
      const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

      const paygRevenues = [];
      Object.values(VBEE_PRODUCT).forEach((feeType) => {
        if (revenue[feeType] || quantity[feeType]) {
          const paygSpecificQuantity = [];
          Object.keys(specificQuantity).forEach((key) => {
            if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
          });
          paygRevenues.push({
            product: convertToProduct(providerName, PAY_TYPE.PAYG, feeType),
            revenue: revenue[feeType],
            quantity: quantity[feeType],
            totalCalledContacts: totalCalledContacts[feeType],
            totalPricedQuantity: totalPricedQuantity[feeType],
            priceUnit: priceUnit[feeType],
            specificQuantity: paygSpecificQuantity,
            currencyUnit,
            unit,
          });
        }
      });

      return paygRevenues;
    }),
  );

  let yearPaygRevenue = [];
  const isEndOfMonth = moment(date).diff(moment(date).endOf('month'), 'days') === 0;
  if (isEndOfMonth) {
    yearPaygRevenue = await Promise.all(
      providerNames.map(async (providerName) => {
        const paygRevenue = await getExpectedYearRevenue(providerName, date);
        const { revenue, quantity, specificQuantity, currencyUnit, unit, totalCalledContacts, totalPricedQuantity, priceUnit } = paygRevenue;

        const paygRevenues = [];
        Object.values(VBEE_PRODUCT).forEach((feeType) => {
          if (revenue[feeType] || quantity[feeType]) {
            const paygSpecificQuantity = [];
            Object.keys(specificQuantity).forEach((key) => {
              if (specificQuantity[key][feeType]) paygSpecificQuantity.push({ label: key, quantity: specificQuantity[key][feeType] });
            });
            paygRevenues.push({
              product: convertToProduct(providerName, PAY_TYPE.PAYG, feeType),
              revenue: revenue[feeType],
              quantity: quantity[feeType],
              totalCalledContacts: totalCalledContacts[feeType],
              totalPricedQuantity: totalPricedQuantity[feeType],
              priceUnit: priceUnit[feeType],
              specificQuantity: paygSpecificQuantity,
              currencyUnit,
              unit,
            });
          }
        });

        return paygRevenues;
      }),
    );
  }

  const dateRevenues = mergeSubProducts(datePaygRevenue.flat(), true);
  const monthRevenues = mergeSubProducts(monthPaygRevenue.flat(), true);
  const yearRevenues = mergeSubProducts(yearPaygRevenue.flat(), true);

  await saveRevenuesToRevenueStats(dateRevenues, date);

  await sendTotalRevenueSlackNoti(REVENUE_ALL_SLACK_CHANNEL, {
    date,
    dateRevenues,
    monthRevenues,
    yearRevenues: isEndOfMonth ? yearRevenues : [],
  });
};
/* eslint-disable prettier/prettier */

const exportRevenueReports = async (date) => {
  const revenueReports = await findRevenueReports({
    startDate: moment(date).utcOffset(7).startOf('date').toISOString(),
    endDate: moment(date).utcOffset(7).endOf('date').toISOString(),
    sort: 'feeType.name_asc,provider.name_asc',
    type: REPORT_TYPE.DAY,
  });

  const dataToExport = revenueReports.map((revenueReport) => {
    const {
      time,
      provider = {},
      feeType = {},
      customerId,
      revenue,
      currencyUnit,
      quantity,
      totalPricedQuantity,
      priceUnit,
      unit,
      totalCalledContacts,
      specificQuantity,
      quantityForCostCalculation = {},
    } = revenueReport;

    const productLabel = convertToProduct(provider.name, PAY_TYPE.PAYG, feeType.name);
    const payType = Object.values(PAY_TYPE).find((payTypeName) => productLabel.includes(payTypeName));
    const service = Object.values(VBEE_PRODUCT).find((serviceName) => productLabel.includes(serviceName));
    const totalQuantity = specificQuantity.reduce((total, { quantity: specQuantity }) => total + specQuantity, 0);

    return [
      moment(time).format('YYYY-MM'),
      moment(time).format('YYYY-MM-DD'),
      VBEE_PRODUCT_VIETNAMESE[service],
      PAY_TYPE_VIETNAMESE[payType],
      service,
      productLabel,
      customerId,
      revenue,
      currencyUnit,
      quantity,
      totalPricedQuantity || quantity,
      priceUnit || unit,
      totalQuantity,
      unit,
      totalCalledContacts,
      quantityForCostCalculation.quantity,
      quantityForCostCalculation.unit,
    ];
  });
  await sheetService.appendRow(REVENUE_REPORTS_SHEET_ID, REVENUE_REPORTS_SHEET_NAME, 'A2', dataToExport);
};

module.exports = {
  notifyProviderRevenue,
  notifySubscriptionRevenue,
  notifySmeRevenue,
  notifyTotalRevenue,
  exportRevenueReports,
};
