const ExcelJS = require('exceljs');

const excelConfig = {
  _id: {
    header: '_id',
    width: 30,
  },
  money: {
    header: 'Tổng tiền',
    width: 10,
  },
  bankCode: {
    header: 'Mã ngân hàng',
    width: 10,
  },
  callbackUrl: {
    header: 'Url callback',
    width: 10,
  },
  ipnUrl: {
    header: 'Url ipn',
    width: 10,
  },
  desc: {
    header: 'Mô tả',
    width: 10,
  },
  customerId: {
    header: 'Id khách hàng',
    width: 30,
  },
  customer: {
    header: 'Khách hàng',
    width: 10,
  },
  type: {
    header: 'Loại',
    width: 10,
  },
  state: {
    header: 'Trạng thái',
    width: 10,
  },
  calledIpn: {
    header: 'Đã gọi ipn',
    width: 10,
  },
  redirected: {
    header: 'Đã chuyển hướng',
    width: 10,
  },
  providerOrderId: {
    header: 'Id đơn hàng của nhà cung cấp',
    width: 10,
  },
  telegramId: {
    header: 'Id Telegram',
    width: 10,
  },
  token: {
    header: 'Token',
    width: 10,
  },
  appTransId: {
    header: 'Id giao dịch ứng dụng',
    width: 10,
  },
  appstoreTransactionId: {
    header: 'Id giao dịch ứng dụng appstore',
    width: 10,
  },
  vnpayId: {
    header: 'Id giao dịch vnpay',
    width: 10,
  },
  link: {
    header: 'Link',
    width: 10,
  },
  bankName: {
    header: 'Tên ngân hàng',
    width: 10,
  },
  bank: {
    header: 'Ngân hàng',
    width: 10,
  },
  channelName: {
    header: 'Tên kênh',
    width: 10,
  },
  providerName: {
    header: 'Tên nhà cung cấp',
    width: 15,
  },
  partnerName: {
    header: 'Tên đối tác',
    width: 10,
  },
  confirmBy: {
    header: 'Xác nhận bởi',
    width: 10,
  },
  responseFromPartner: {
    header: 'Phản hồi từ nhà cung cấp',
    width: 10,
  },
  createdAt: {
    header: 'Ngày tạo',
    width: 10,
  },
  updatedAt: {
    header: 'Ngày cập nhật',
    width: 10,
  },
  currencyUnit: {
    header: 'Đơn vị tiền tệ',
    width: 10,
  },
  feeType: {
    header: 'Loại phí',
    width: 10,
  },
  time: {
    header: 'Thời gian',
    width: 10,
  },
  quantity: {
    header: 'Số lượng',
    width: 10,
  },
  recheckState: {
    header: 'Trạng thái kiểm tra lại',
    width: 20,
  },
  recheckMoney: {
    header: 'Số tiền kiểm tra lại',
    width: 20,
  },
  isRecheckFinal: {
    header: 'Đã kiểm tra lại',
    width: 10,
  },
  numberRequest: {
    header: 'Số lượng request',
    width: 10,
  },
};

// transactions example:
// [{
//     money: 149000,
//     channel: { name: 'vbee' },
//     provider: { name: 'vbee' },
//     partner: { name: 'vnpay' },
//     createdAt: 2022-03-23T09:19:00.122Z
//   }]
/**
 * this function convert an array of transactions to excel
 * @param {array} transactions Transactions need to convert
 * @returns workbook
 */
const convertTransactionsToExcel = (transactions) => {
  if (!transactions?.length) {
    return null;
  }
  const workbook = new ExcelJS.Workbook();
  workbook.properties.date1904 = true;
  const sheet = workbook.addWorksheet('Data');

  sheet.columns = Object.keys(transactions[0]).map((key) => {
    switch (key) {
      case 'channel':
        return {
          header: excelConfig.channelName?.header,
          key: 'channelName',
          width: excelConfig.channelName?.width,
        };
      case 'provider':
        return {
          header: excelConfig.providerName?.header,
          key: 'providerName',
          width: excelConfig.providerName?.width,
        };
      case 'partner':
        return {
          header: excelConfig.partnerName?.header,
          key: 'partnerName',
          width: excelConfig.partnerName?.width,
        };
      default:
        return {
          header: excelConfig[key]?.header,
          key,
          width: excelConfig[key]?.width,
        };
    }
  });

  const rows = transactions.map((item) => {
    const row = {};
    Object.keys(item).forEach((key) => {
      switch (key) {
        case 'provider':
          row.providerName = item.provider.name;
          break;
        case 'partner':
          row.partnerName = item.partner.name;
          break;
        case 'channel':
          row.channelName = item.channel.name;
          break;
        default:
          row[key] = item[key];
          break;
      }
    });
    return row;
  });

  sheet.addRows(rows);

  return workbook;
};

/**
 *
 * reconcileOrders: [{
 *  money - number,
 *  customerId - string,
 *  type - DATE or MONTH,
 *  provider - { name },
 *  channel - { name },
 *  currencyUnit - string,
 *  feeType - string,
 *  time - date,
 * }]
 */
const convertReconcileOrdersToExcel = (reconcileOrders) => {
  if (!reconcileOrders?.length) {
    return null;
  }
  const workbook = new ExcelJS.Workbook();
  workbook.properties.date1904 = true;
  const sheet = workbook.addWorksheet('Data');

  sheet.columns = Object.keys(reconcileOrders[0]).map((key) => {
    switch (key) {
      case 'provider':
        return {
          header: excelConfig.providerName?.header || key,
          key: 'providerName',
          width: excelConfig.providerName?.width || 10,
        };
      case 'channel':
        return {
          header: excelConfig.channelName?.header || key,
          key: 'channelName',
          width: excelConfig.channelName?.width || 10,
        };
      default:
        return {
          header: excelConfig[key]?.header || key,
          key,
          width: excelConfig[key]?.width || 10,
        };
    }
  });

  const rows = reconcileOrders.map((item) => {
    const row = {};
    Object.keys(item).forEach((key) => {
      switch (key) {
        case 'provider':
          row.providerName = item.provider.name;
          break;
        case 'channel':
          row.channelName = item.channel.name;
          break;
        default:
          row[key] = item[key];
          break;
      }
    });
    return row;
  });

  sheet.addRows(rows);

  return workbook;
};

module.exports = { convertTransactionsToExcel, convertReconcileOrdersToExcel };
