const { PARTNER_NAME, TRANSACTION_STATE } = require('../constants');
const {
  findTransactions,
  updateTransaction,
  findMismatchedTransactions,
} = require('./transaction');
const { getPartner: getPartnerModel, getPartnerFunc } = require('./partner');
const { email } = require('./notification');
const { convertTransactionsToExcel } = require('../utils/convertToExcel');
const { EMAIL_TO } = require('../configs');
const logger = require('../utils/logger');

const recheckPartners = [
  PARTNER_NAME.ZALOPAY,
  PARTNER_NAME.SHOPEE_PAY,
  PARTNER_NAME.PAYPAL,
];

/**
 * in period from startDate to endDate
 * for each partner
 * get total revenue from db and compare with partner's total revenue
 * @return [{
 *  name: 'zalopay',
 *  vbeeTotal: 100,
 *  partnerTotal: 90,
 *  isAlert: true
 * }]
 */
const getRecheckRevenue = async ({ startDate, endDate }) => {
  const { transactions } = await findTransactions({
    fields:
      '_id,transactionId,money,partner.name,appTransId,state,createdAt,provider.name,recheckState,recheckMoney,isRecheckFinal',
    offset: 0,
    limit: 0,
    query: {
      startDate,
      endDate,
    },
  });

  const recheckData = {};
  recheckPartners.forEach((partnerName) => {
    recheckData[partnerName] = {
      vbeeTotal: 0,
      partnerTotal: 0,
      transactions: [], // transactions to recheck
    };
  });

  transactions.forEach((transaction) => {
    const { name } = transaction.partner;
    if (!recheckData[name]) return;
    if (transaction.state === TRANSACTION_STATE.SUCCESS) {
      recheckData[name].vbeeTotal += transaction.money;
    }
    if (transaction.isRecheckFinal) {
      recheckData[name].partnerTotal += transaction.recheckMoney;
    } else {
      recheckData[name].transactions.push(transaction);
    }
  });

  const res = await Promise.all(
    recheckPartners.map(async (partnerName) => {
      const partnerModel = await getPartnerModel({ name: partnerName });
      const partnerFunc = getPartnerFunc(partnerName);
      const { config } = partnerModel;

      const response = await partnerFunc.getTransactionsStatus({
        config,
        transactions: recheckData[partnerName].transactions,
      });
      await Promise.all(
        response.map(async (recheckedTransaction) => {
          const { transactionId, recheckState, recheckMoney, isRecheckFinal } =
            recheckedTransaction;
          if (recheckState === TRANSACTION_STATE.SUCCESS) {
            recheckData[partnerName].partnerTotal += recheckMoney;
          }
          if (isRecheckFinal) {
            await updateTransaction(
              { transactionId },
              {
                isRecheckFinal: true,
                recheckState,
                recheckMoney,
              },
            );
          }
        }),
      );

      const { vbeeTotal, partnerTotal } = recheckData[partnerName];

      const differentPercent = ((partnerTotal - vbeeTotal) / vbeeTotal) * 100;
      const isAlert = Math.abs(differentPercent) > 1;

      return {
        name: partnerName,
        vbeeTotal,
        partnerTotal,
        isAlert,
      };
    }),
  );

  return res;
};

const getHtmlText = (contents) => {
  let htmlText = `<h2>Recheck revenue alert</h2>
  <table border="1">
    <tr>
      <th>Partner</th>
      <th>Vbee total</th>
      <th>Partner total</th>
    </tr>`;
  contents.forEach((item) => {
    const { name, vbeeTotal, partnerTotal } = item;
    htmlText += `<tr>
      <td>${name}</td>
      <td>${vbeeTotal}</td>
      <td>${partnerTotal}</td>
    </tr>`;
  });
  htmlText += '</table>';
  return htmlText;
};

const recheckRevenue = async ({ startDate, endDate }) => {
  try {
    const result = await getRecheckRevenue({ startDate, endDate });
    const contents = [];
    const attachments = [];
    await Promise.all(
      result.map(async (item) => {
        if (item.isAlert) {
          contents.push(item);
          const mismatchedTransactions = await findMismatchedTransactions({
            partnerName: item.name,
            startDate,
            endDate,
          });
          const workbook = convertTransactionsToExcel(mismatchedTransactions);
          if (workbook) {
            const excelFile = {
              filename: `${item.name}_recheck_revenue.xlsx`,
              content: await workbook.xlsx.writeBuffer(),
            };
            attachments.push(excelFile);
          }
        }
      }),
    );
    if (contents.length > 0) {
      const mailOptions = {
        subject: 'Recheck revenue alert',
        to: EMAIL_TO,
        text: '',
        htmlText: getHtmlText(contents),
        attachments,
      };
      await email.send(mailOptions);
    }
  } catch (error) {
    logger.error(error, { ctx: 'recheckRevenue' });
  }
};

module.exports = {
  getRecheckRevenue,
  recheckRevenue,
};
