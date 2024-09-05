const moment = require('moment');
const {
  SLACK_NOTI_URL,
  SLACK_NOTI_TOKEN,
  SLACK_NOTI_CHANNEL,
} = require('../../configs');
const callApi = require('../../utils/callApi');
const { getPercentString } = require('../../utils/util');

const sendSlackNoti = async ({
  text,
  channel = SLACK_NOTI_CHANNEL,
  blocks,
}) => {
  try {
    const data = await callApi({
      method: 'POST',
      url: SLACK_NOTI_URL,
      headers: {
        Authorization: SLACK_NOTI_TOKEN,
      },
      data: {
        text,
        channel,
        blocks,
      },
    });
    return data.result;
  } catch (err) {
    return {};
  }
};

const sendRevenueSlackNoti = async (date, revenue, monthRevenue) => {
  const title = `*Thống kê ngày ${moment(date).format('DD-MM-YYYY')}*`;
  const contents = Object.keys(revenue).reduce((acc, provider) => {
    const { totalMoney, totalQuantity, ...feeTypes } = revenue[provider];
    let moneyText = `*Tổng tiền:* ${totalMoney.toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
    })}`;
    let quantityText = `*Tổng số call:* ${totalQuantity.toLocaleString(
      'vi-VN',
    )}`;
    Object.keys(feeTypes).forEach((feeType) => {
      const {
        totalMoney: feeTypeTotalMoney,
        totalQuantity: feeTypeTotalQuantity,
      } = feeTypes[feeType];

      moneyText += `\n   *${feeType}:* ${feeTypeTotalMoney.toLocaleString(
        'vi-VN',
        {
          style: 'currency',
          currency: 'VND',
        },
      )}`;
      quantityText += `\n   *${feeType}:* ${feeTypeTotalQuantity.toLocaleString(
        'vi-VN',
      )}`;
    });

    acc.push(`*${provider}*\n${moneyText}\n\n${quantityText}`);
    return acc;
  }, []);

  const monthTitle = `*Thống kê tháng ${moment(date).format('MM-YYYY')}*`;
  const monthContents = Object.keys(monthRevenue).reduce((acc, provider) => {
    const { totalMoney, totalQuantity, ...feeTypes } = monthRevenue[provider];
    let moneyText = `*Tổng tiền:* ${totalMoney.toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
    })}`;
    let quantityText = `*Tổng số call:* ${totalQuantity.toLocaleString(
      'vi-VN',
    )}`;
    Object.keys(feeTypes).forEach((feeType) => {
      const {
        totalMoney: feeTypeTotalMoney,
        totalQuantity: feeTypeTotalQuantity,
      } = feeTypes[feeType];

      moneyText += `\n   *${feeType}:* ${feeTypeTotalMoney.toLocaleString(
        'vi-VN',
        {
          style: 'currency',
          currency: 'VND',
        },
      )}`;
      quantityText += `\n   *${feeType}:* ${feeTypeTotalQuantity.toLocaleString(
        'vi-VN',
      )}`;
    });

    acc.push(`*${provider}*\n${moneyText}\n\n${quantityText}`);
    return acc;
  }, []);

  const text = `${title}\n${contents.join(
    '\n------------------------\n',
  )}\n************************\n${monthTitle}\n${monthContents.join(
    '\n------------------------\n',
  )}`;
  await sendSlackNoti({ text });
};

/* eslint-disable prettier/prettier */
// eslint-disable-next-line max-len
const getProductRevenueTexts = ({ product, revenue = 0, quantity, specificQuantity = [], currencyUnit, unit, userStats, priceUnit, totalPricedQuantity, totalCalledContacts }) => {
  const productText = `\t*${product}: * \`${Math.round(revenue).toLocaleString()}\` ${currencyUnit || 'VND'}`;
  const userStatsTexts = [];
  const quantityTexts = [];

  const { totalNewUsers = 0, totalSwitchUsers = 0 } = userStats || {};
  const totalUsers = totalNewUsers + totalSwitchUsers;

  if (totalUsers) {
    userStatsTexts.push(`\t- Tổng khách hàng mới: ${totalUsers.toLocaleString()}`);
    userStatsTexts.push(`\t\t+ Tổng khách đăng ký mới: ${totalNewUsers.toLocaleString()} (${getPercentString(totalNewUsers, totalUsers)}%)`);
    userStatsTexts.push(`\t\t+ Tổng khách chuyển phiên bản: ${totalSwitchUsers.toLocaleString()} (${getPercentString(totalSwitchUsers, totalUsers)}%)`);
  }
  if (quantity || specificQuantity.length) {
    quantityTexts.push(`\t- Sản lượng tính tiền: ${quantity?.toLocaleString() || 0} ${priceUnit || unit || ''}`);
  }
  if (totalPricedQuantity && priceUnit !== unit) {
    quantityTexts.push(`\t- Tổng sản lượng theo đơn vị tính tiền: ${totalPricedQuantity.toLocaleString()} ${priceUnit || unit || ''}`);
  }

  if (totalCalledContacts) quantityTexts.push(`\t- Tổng số contact đã gọi: ${totalCalledContacts.toLocaleString()}`);

  const totalQuantity = specificQuantity.reduce((total, curr) => total + curr.quantity, 0);
  if (totalQuantity) quantityTexts.push(`\t- Tổng sản lượng chi tiết: ${totalQuantity.toLocaleString()} ${unit || ''}`);
  specificQuantity.forEach(({ label, quantity: value }) => {
    if (value) quantityTexts.push(`\t\t+ ${label}: ${value.toLocaleString()} (${getPercentString(value, totalQuantity)}%)`);
  });

  return [productText, ...userStatsTexts, ...quantityTexts];
};
/* eslint-disable prettier/prettier */

const getRevenueStatsBlocks = ({
  providerName,
  date,
  expectedDateRevenue,
  expectedMonthRevenue,
}) => {
  // header block
  const headerBlock = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `Thống kê ${providerName} ngày ${moment(date).format(
        'DD-MM-YYYY',
      )}`,
      emoji: true,
    },
  };

  const { revenue, quantity, specificQuantity, currencyUnit, unit } =
    expectedDateRevenue;

  // expected revenue block
  const totalDateRevenue = Object.values(revenue).reduce(
    (prev, val) => prev + val,
    0,
  );
  const dateRevenueText = Object.keys(revenue).reduce((prev, feeType) => {
    const ratePercent = totalDateRevenue
      ? (revenue[feeType] / totalDateRevenue) * 100
      : 0;
    const str = prev.concat(
      `${feeType}:  ${revenue[
        feeType
      ]?.toLocaleString()} (${ratePercent?.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })}%)\n`,
    );
    return str;
  }, `*:dollar: Doanh thu dự kiến: * \`${totalDateRevenue?.toLocaleString()}\` ${currencyUnit}\n>>>`);
  const expectedRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: dateRevenueText },
  };

  // quantity block
  const totalDateQuantity = Object.values(quantity).reduce(
    (prev, val) => prev + val,
    0,
  );
  const dateQuantityText = Object.keys(quantity).reduce((prev, feeType) => {
    const ratePercent = totalDateQuantity
      ? (quantity[feeType] / totalDateQuantity) * 100
      : 0;
    const str = prev.concat(
      `${feeType}:  ${quantity[
        feeType
      ]?.toLocaleString()} (${ratePercent?.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })}%)\n`,
    );
    return str;
  }, `*:trophy: Sản lượng tính tiền: * \`${totalDateQuantity?.toLocaleString()}\` ${unit}\n>>>`);
  const quantityBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: dateQuantityText },
  };

  // specific quantity block
  const specificQuantityBlocks = [];
  Object.keys(specificQuantity).forEach((quantityType) => {
    const specificValue = specificQuantity[quantityType];
    const totalQuantity = Object.values(specificValue).reduce(
      (prev, val) => prev + val,
      0,
    );
    const text = Object.keys(specificValue).reduce((prev, feeType) => {
      const ratePercent = totalQuantity
        ? (specificValue[feeType] / totalQuantity) * 100
        : 0;
      const str = prev.concat(
        `${feeType}:  ${specificValue[
          feeType
        ]?.toLocaleString()} (${ratePercent?.toLocaleString(undefined, {
          maximumFractionDigits: 1,
        })}%)\n`,
      );
      return str;
    }, `*:placard: ${quantityType}: * \`${totalQuantity?.toLocaleString()}\` ${unit}\n>>>`);
    const block = {
      type: 'section',
      text: { type: 'mrkdwn', text },
    };

    specificQuantityBlocks.push(block);
  });

  // month stats block
  const { revenue: monthRevenue, quantity: monthQuantity } =
    expectedMonthRevenue;
  const monthTexts = [
    `*:heavy_dollar_sign: Tổng doanh thu từ đầu tháng ${moment(date).format(
      'MM-YYYY',
    )}*\n>>>`,
  ];
  // revenue
  const totalMonthRevenue = Object.values(monthRevenue).reduce(
    (prev, val) => prev + val,
    0,
  );
  const monthRevenueText = Object.keys(monthRevenue).reduce((prev, feeType) => {
    const ratePercent = totalMonthRevenue
      ? (monthRevenue[feeType] / totalMonthRevenue) * 100
      : 0;
    const str = prev.concat(
      `-     ${feeType}:  ${monthRevenue[
        feeType
      ]?.toLocaleString()} (${ratePercent?.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })}%)\n`,
    );
    return str;
  }, `*Trả sau dự kiến: * ${totalMonthRevenue?.toLocaleString()} ${expectedMonthRevenue.currencyUnit}\n`);
  monthTexts.push(monthRevenueText);
  // quantity
  const totalMonthQuantity = Object.values(monthQuantity).reduce(
    (prev, val) => prev + val,
    0,
  );
  const monthQuantityText = Object.keys(monthQuantity).reduce(
    (prev, feeType) => {
      const ratePercent = totalMonthQuantity
        ? (monthQuantity[feeType] / totalMonthQuantity) * 100
        : 0;
      const str = prev.concat(
        `-     ${feeType}:  ${monthQuantity[
          feeType
        ]?.toLocaleString()} (${ratePercent?.toLocaleString(undefined, {
          maximumFractionDigits: 1,
        })}%)\n`,
      );
      return str;
    },
    `*Sản lượng tính tiền: * ${totalMonthQuantity?.toLocaleString()} ${
      expectedMonthRevenue?.unit
    }\n`,
  );
  monthTexts.push(monthQuantityText);
  const monthBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: monthTexts.join(''),
    },
  };

  const blocks = [
    headerBlock,
    expectedRevenueBlock,
    quantityBlock,
    ...specificQuantityBlocks,
    monthBlock,
  ];
  return blocks;
};

const getProviderRevenueBlocks = ({ date, dateRevenues, monthRevenues, displayName }) => {
  const dateStr = moment(date).format('DD-MM-YYYY');
  const monthStr = moment(date).format('MM-YYYY');
  const totalDateRevenue = dateRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);
  const totalMonthRevenue = monthRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);

  const headerBlock = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `Thống kê doanh thu ${displayName}`,
      emoji: true,
    },
  };

  const contentText = [`*:moneybag: Tổng doanh thu trong ngày ${dateStr}: * \`${totalDateRevenue.toLocaleString()}\` VND\n`];
  dateRevenues.forEach((product) => {
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      texts[0] = `:point_right: ${texts[0].substring(1)}`;
      contentText.push(...texts);
    });
  });
  const dateRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${contentText.join('\n')}` },
  };

  const monthText = [];
  monthText.push(`*:moneybag: Thống kê doanh thu trong tháng ${monthStr}: * \`${totalMonthRevenue.toLocaleString()}\` ${monthRevenues.currencyUnit || 'VND'}\n`);
  monthRevenues.forEach((product) => {
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      texts[0] = `:point_right: ${texts[0].substring(1)}`;
      monthText.push(...texts);
    });
  });
  const monthRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${monthText.join('\n')}` },
  };

  return [headerBlock, dateRevenueBlock, monthRevenueBlock];
};

const getSubRevenueBlocks = ({
  date,
  dateRevenues,
  monthRevenues,
}) => {
  const dateStr = moment(date).format('DD-MM-YYYY');
  const monthStr = moment(date).format('MM-YYYY');
  const totalDateRevenue = dateRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);
  const totalMonthRevenue = monthRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);

  const headerBlock = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Thống kê doanh thu trả trước',
      emoji: true,
    },
  };

  const contentText = [`*:moneybag: Tổng doanh thu trong ngày ${dateStr}: * \`${totalDateRevenue.toLocaleString()}\` VND\n`];
  dateRevenues.forEach((product) => {
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      texts[0] = `:point_right: ${texts[0].substring(1)}`;
      contentText.push(...texts);
    });
  });
  const dateRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${contentText.join('\n')}` },
  };

  const monthText = [];
  monthText.push(`*:moneybag: Thống kê doanh thu trong tháng ${monthStr}: * \`${totalMonthRevenue.toLocaleString()}\` ${monthRevenues.currencyUnit || 'VND'}\n`);
  monthRevenues.forEach((product) => {
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      texts[0] = `:point_right: ${texts[0].substring(1)}`;
      monthText.push(...texts);
    });
  });
  const monthRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${monthText.join('\n')}` },
  };

  return [headerBlock, dateRevenueBlock, monthRevenueBlock];
};

const getSmeRevenueBlocks = ({ date, dateRevenues, monthRevenues }) => {
  const dateStr = moment(date).format('DD-MM-YYYY');
  const monthStr = moment(date).format('MM-YYYY');
  const totalDateRevenue = dateRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);
  const totalMonthRevenue = monthRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);

  const headerBlock = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Thống kê doanh thu các doanh nghiệp SME',
      emoji: true,
    },
  };

  const contentText = [`*:moneybag: Tổng doanh thu trong ngày ${dateStr}: * \`${totalDateRevenue.toLocaleString()}\` VND\n`];
  dateRevenues.forEach((product) => {
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      texts[0] = `:point_right: ${texts[0].substring(1)}`;
      contentText.push(...texts);
    });
  });
  const dateRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${contentText.join('\n')}` },
  };

  const monthText = [];
  monthText.push(`*:moneybag: Thống kê doanh thu trong tháng ${monthStr}: * \`${totalMonthRevenue.toLocaleString()}\` ${monthRevenues.currencyUnit || 'VND'}\n`);
  monthRevenues.forEach((product) => {
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      texts[0] = `:point_right: ${texts[0].substring(1)}`;
      monthText.push(...texts);
    });
  });
  const monthRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${monthText.join('\n')}` },
  };

  return [headerBlock, dateRevenueBlock, monthRevenueBlock];
};

const getTotalRevenueBlocks = ({ date, dateRevenues, monthRevenues, yearRevenues }) => {
  const dateStr = moment(date).format('DD-MM-YYYY');
  const monthStr = moment(date).format('MM-YYYY');
  const yearStr = moment(date).format('YYYY');
  const totalDateRevenue = dateRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);
  const totalMonthRevenue = monthRevenues.reduce((total, curr) => total + (curr.revenue || 0), 0);
  const totalYearRevenue = yearRevenues?.reduce((total, curr) => total + (curr.revenue || 0), 0);

  const dateRevenueBlocks = [];
  const titleText = [`*:moneybag: Tổng doanh thu trong ngày ${dateStr}: * \`${totalDateRevenue.toLocaleString()}\` VND\n`];
  dateRevenues.forEach((product, index) => {
    const productText = index === 0 ? titleText : [];
    productText.push(`*:point_right: ${product.product}: *\`${product.revenue?.toLocaleString()}\` ${product.currencyUnit || 'VND'}`);
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      productText.push(...texts);
    });
    dateRevenueBlocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `>>>${productText.join('\n')}` },
    });
  });

  const monthRevenueBlocks = [];
  const monthTitleText = [`*:moneybag: Tổng doanh thu trong tháng ${monthStr}: * \`${totalMonthRevenue.toLocaleString()}\` VND\n`];
  monthRevenues.forEach((product, index) => {
    const productText = index === 0 ? monthTitleText : [];
    productText.push(`*:point_right: ${product.product}: *\`${product.revenue?.toLocaleString()}\` ${product.currencyUnit || 'VND'}`);
    product.subProducts?.forEach((subProduct) => {
      const texts = getProductRevenueTexts(subProduct);
      productText.push(...texts);
    });
    monthRevenueBlocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `>>>${productText.join('\n')}` },
    });
  });

  const yearRevenueBlocks = [];
  const yearTitleText = [`*:moneybag: Tổng doanh thu từ đầu năm ${yearStr}: * \`${totalYearRevenue.toLocaleString()}\` VND\n`];
  if (yearRevenues?.length) {
    yearRevenues.forEach((product, index) => {
      const productText = index === 0 ? yearTitleText : [];
      productText.push(`*:point_right: ${product.product}: *\`${product.revenue?.toLocaleString()}\` ${product.currencyUnit || 'VND'}`);
      product.subProducts?.forEach((subProduct) => {
        const texts = getProductRevenueTexts(subProduct);
        productText.push(...texts);
      });
      yearRevenueBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `>>>${productText.join('\n')}` },
      });
    });
  }

  return [...dateRevenueBlocks, ...monthRevenueBlocks, ...yearRevenueBlocks];
};

const getPartnerRevenueBlocks = ({ date, dateRevenues = {}, monthRevenues = {} }) => {
  const dateStr = moment(date).format('DD-MM-YYYY');
  const monthStr = moment(date).format('MM-YYYY');
  const totalDateRevenue =
    Object.values(dateRevenues).reduce((total, curr) => total + (curr.revenue || 0), 0);
  const totalMonthRevenue =
    Object.values(monthRevenues).reduce((total, curr) => total + (curr.revenue || 0), 0);

  const headerBlock = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: 'Thống kê doanh thu trả trước theo kênh thanh toán',
      emoji: true,
    },
  };

  const contentText = [`*:moneybag: Tổng doanh thu trong ngày ${dateStr}: * \`${Math.round(totalDateRevenue).toLocaleString()}\` VND\n`];
  Object.keys(dateRevenues).forEach((provider) => {
    const { revenue = 0, partners } = dateRevenues[provider] || {};
    contentText.push(`:point_right: *${provider}*: \`${Math.round(revenue).toLocaleString()}\` VND`);
    partners?.forEach((partner) => {
      contentText.push(`\t- ${partner.name}: \`${Math.round(partner.revenue || 0).toLocaleString()}\` VND`);
    });
  });
  const dateRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${contentText.join('\n')}` },
  };

  const monthText = [`*:moneybag: Tổng doanh thu trong tháng ${monthStr}: * \`${Math.round(totalMonthRevenue).toLocaleString()}\` VND\n`];
  Object.keys(monthRevenues).forEach((provider) => {
    const { revenue = 0, partners } = monthRevenues[provider] || {};
    monthText.push(`:point_right: *${provider}*: \`${Math.round(revenue).toLocaleString()}\` VND`);
    partners?.forEach((partner) => {
      monthText.push(`\t- ${partner.name}: \`${Math.round(partner.revenue || 0).toLocaleString()}\` VND`);
    });
  });
  const monthRevenueBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: `>>>${monthText.join('\n')}` },
  };

  return [headerBlock, dateRevenueBlock, monthRevenueBlock];
};

const sendRevenueStatsSlackNoti = async (slackChannel, info) => {
  const blocks = getRevenueStatsBlocks(info);
  await sendSlackNoti({ channel: slackChannel, blocks });
};

const sendProviderRevenueSlackNoti = async (slackChannel, info) => {
  const blocks = getProviderRevenueBlocks(info);
  await sendSlackNoti({ channel: slackChannel, blocks });
};

const sendSubRevenueSlackNoti = async (slackChannel, info) => {
  const blocks = getSubRevenueBlocks(info);
  await sendSlackNoti({ channel: slackChannel, blocks });
};

const sendSmeRevenueSlackNoti = async (slackChannel, info) => {
  const blocks = getSmeRevenueBlocks(info);
  await sendSlackNoti({ channel: slackChannel, blocks });
};

const sendTotalRevenueSlackNoti = async (slackChannel, info) => {
  const blocks = getTotalRevenueBlocks(info);
  for (let i = 0; i < blocks.length; i += 1) {
    await sendSlackNoti({ channel: slackChannel, blocks: [blocks[i]] });
  }
};

const sendPartnerRevenueSlackNoti = async (slackChannel, info) => {
  const blocks = getPartnerRevenueBlocks(info);
  await sendSlackNoti({ channel: slackChannel, blocks });
};

module.exports = {
  sendSlackNoti,
  sendRevenueSlackNoti,
  sendRevenueStatsSlackNoti,
  sendProviderRevenueSlackNoti,
  sendSubRevenueSlackNoti,
  sendSmeRevenueSlackNoti,
  sendTotalRevenueSlackNoti,
  sendPartnerRevenueSlackNoti,
};
