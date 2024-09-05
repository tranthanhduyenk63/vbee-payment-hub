/* eslint-disable */
const axios = require('axios').default;
const CryptoJS = require('crypto-js');
const moment = require('moment');
var dateFormat = require('dateformat');
let {
    upload_data, 
    list_folder,
    get_config_channel,
    verified_token,
    google_sheet_report,
    updateSheetByKey,
    get_object_from_s3,
} = require('./utils');

const logger = require('../utils/logger');

// const config = require('../conf/zalopay_config.json');
const Crypto = require('./Crypto');
const { TRANSACTION_STATE, PARTNER_NAME, BATCH_SIZE } = require('../constants');
const Transaction = require('../model/transaction');
const Partner = require('../model/partner');
const batchRequest = require('../utils/batchRequest');

const order_types = ['GOODS', 'TRANSPORTATION', 'HOTEL', 'FOOD', 'TELCARD', 'BILLING'];
const product_codes = ['ESCROW', 'QR', 'DIRECT', 'AGREEMENT'];
const currency = 'VND';

const bucket_name = process.env.BUCKET_NAME;

async function  getListMerchantBanks({config}) {
  console.log(JSON.stringify(config))
  const { test, app_id, key1} = config;
  const testBase = 'https://sbgateway.zalopay.vn/api/getlistmerchantbanks';
  const prodBase = 'https://gateway.zalopay.vn/api/getlistmerchantbanks';
  const url = test ? testBase : prodBase;
  const reqtime = Date.now();
  let params = { appid: app_id, reqtime };
  console.log(params);
  const data = [app_id, reqtime].join('|');
  const mac = CryptoJS.HmacSHA256(data, key1).toString();
  params = Object.assign(params, { mac });

  return new Promise(resolve => {
    axios
      .get(url, { params })
      .then(res => {
        const { data = {} } = res;
        const { banks = {} } = data;
        const keys = Object.keys(banks);
        let list = [];
        for (const key of keys) {
          console.log(banks[key]);
          list = list.concat(banks[key]);
        }
        console.log(list);
        resolve(list);
      })
      .catch(error => {
        const { response = {} } = error;
        const { data = {} } = response;
        resolve(data);
      });
  });
}

async function getRefundStatus(m_refund_id){
  const { base, app_id, key1} = config;
  const url = `${base}/query_refund`;
  const timestamp = Date.now().toString();

  const data = [app_id, m_refund_id, timestamp].join('|');
  const mac = CryptoJS.HmacSHA256(data, key1).toString();

  const params = new URLSearchParams();
  params.append('app_id', app_id);
  params.append('m_refund_id', m_refund_id);
  params.append('timestamp', timestamp);
  params.append('mac', mac);

  return new Promise(resolve => {
    axios
      .post(url, params)
      .then(res => resolve(res.data))
      .catch(error => {
        const { response = {} } = error;
        const { data = {} } = response;
        resolve(data);
      });
});
}

//    async refund(
//     zp_trans_id,
//     amount = 0,
//     description = ''
//   ){
//     const self = this;
//     const { base = '', app_id = '', key1 = '' } = self;
//     const url = `${base}/refund`;

//     const timestamp = Date.now();
//     const uid = self.generateOTP(10);
//     const m_refund_id = `${moment().format('YYMMDD')}_${app_id}_${uid}`;

//     let params = { app_id, zp_trans_id, amount, description, timestamp, m_refund_id };
//     const data = [app_id, zp_trans_id, amount, description, timestamp].join('|');
//     const mac = CryptoJS.HmacSHA256(data, key1).toString();
//     params = Object.assign(params, { mac });

//     return new Promise(resolve => {
//       axios
//         .post(url, null, { params })
//         .then(res => resolve(res.data))
//         .catch(error => {
//           const { response = {} } = error;
//           const { data = {} } = response;
//           resolve(data);
//         });
//     });
//   }

   async function getTransactionStatus({config, app_trans_id}){
    const { base , appId , key1} = config;
    const url = `${base}/query`;

    const data = [`${appId}`, `${app_trans_id}`, `${key1}`].join('|');
    const mac = CryptoJS.HmacSHA256(data, key1).toString();

    const params = new URLSearchParams();
    params.append('app_id', appId);
    params.append('app_trans_id', app_trans_id);
    params.append('mac', mac);

    return new Promise(resolve => {
      axios
        .post(url, params)
        .then(res => resolve({...res.data, transactionId: app_trans_id}))
        .catch(error => {
          const { response = {} } = error;
          const { data = {} } = response;
          resolve({...data, transactionId: app_trans_id});
        });
    });
  }

//    handleCallback(requestBody) {
//     const self = this;
//     const { key2 = '' } = self;
//     const { data: dataStr, mac: reqMac } = requestBody;
//     const mac = CryptoJS.HmacSHA256(dataStr, key2).toString();

//     if (reqMac !== mac) return { code: -1, message: 'Invalid Mac' };

//     try {
//       const data = JSON.parse(dataStr);
//       return { code: 1, message: 'success', data };
//     } catch (error) {
//       return { code: 0, message: error.message };
//     }
//   }

   async function createTransaction({config, transaction}){
    
    const { base } = config;
    const url = `${base}/create`;
    const params = createTransactionParams({config, transaction});
    const { app_trans_id = '' } = params;

    return new Promise(resolve => {
      axios
        .post(url, params)
        .then(res => {
          let { data = {} } = res;
          data = Object.assign(data, { app_trans_id });
          resolve(data);
        })
        .catch(error => {
          const { response = {} } = error;
          const { data = {} } = response;
          resolve(data);
        });
    });
  }

function   createTransactionParams({config, transaction}) {
    const { appId: app_id, key1  } = config;
    const app_trans_id = `${moment().utcOffset(7).format('YYMMDD')}${generateOTP(8)}`;
    const app_time = Date.now();
    let {
      app_user = '',
      amount = 0,
      bank_code = '',
      description = '',
      /**
       * optional
       */
      callback_url = '',
      title = '',
      phone = '',
      email = '',
      address = ''
    } = transaction;

    const {
      item = '',
      order_type = '',
      embed_data = '',
      device_info = '',
      product_code = ''
    } = processTransactionData(transaction);

    let requestBody = {
      app_id: parseInt(app_id, 10),
      app_user,
      app_trans_id,
      app_time,
      amount,
      order_type,
      title,
      description,
      callback_url,
      device_info,
      item,
      embed_data,
      currency,
      product_code,
      bank_code,
      phone,
      email,
      address
    };

    const data = [app_id, app_trans_id, app_user, amount, app_time, embed_data, item].join('|');

    const mac = CryptoJS.HmacSHA256(data, key1).toString();
    requestBody = Object.assign(requestBody, { mac });
    return requestBody;
  }

function generateOTP(length = 4) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

function   processTransactionData(data) {
    let {
      items = [],
      order_type = '',
      product_code = '',
      redirecturl = '',
      zlppaymentid = '',
      campaigncode = '',
      columninfo = {},
      device_info = {}
    } = data;
    // item
    const item = JSON.stringify(items);
    // order_type
    order_type = order_type.toUpperCase();
    if (!order_types.includes(order_type)) order_type = 'GOODS';
    // product_code
    product_code = product_code.toUpperCase();
    if (!product_codes.includes(product_code)) product_code = '';
    // embed_data
    let embed_data  = {};
    embed_data = redirecturl ? Object.assign(embed_data, { redirecturl }) : embed_data;
    embed_data = zlppaymentid ? Object.assign(embed_data, { zlppaymentid }) : embed_data;
    embed_data = campaigncode
      ? Object.assign(embed_data, { promotioninfo: JSON.stringify({ campaigncode }) })
      : embed_data;
    embed_data = columninfo
      ? Object.assign(embed_data, { columninfo: JSON.stringify(columninfo) })
      : embed_data;
    embed_data = JSON.stringify(embed_data);
    // device_info
    device_info = JSON.stringify(device_info);

    return { item, order_type, product_code, embed_data, device_info };
}

async function verified_data({config, query, transaction}){
  let data = query;
  let checksumData = data.appid + '|' + data.apptransid + '|' + data.pmcid + '|' + data.bankcode + '|' + data.amount + '|' + data.discountamount + '|' + data.status;
  let checksum = CryptoJS.HmacSHA256(checksumData, config.key2).toString();
  console.log(checksum,'data.checksum',data.checksum);
  if (checksum != data.checksum) {
     return {
            error: -1,
            error_msg: `Fail checksum`
    }
  } else {
    let info = await getTransactionStatus({config, app_trans_id:data.apptransid});
    logger.info(`info get transaction status: ${JSON.stringify(info)}`, { ctx: 'zalopay verify_data'});

    if(info.return_code === 1){
      return {
            error: 0,
            error_msg: `Thành Công`
        }
    }
    return {
        error: 1,
        error_msg: `Thanh toán không thành công`
    }
  }

}
function getConfig(config){

  return {
    "app_id":config['zalopay app_id'],
    "key1":config['zalopay key 1'],
    "key2":config['zalopay key 2'],
    "base": config['zalopay base']
  }
} 
async function create_payment({config, money, bank_code, callback_url, desc, provider, token, request_id, redirect_domain}){
    console.log(`zalo create_payment`, JSON.stringify({config, money, bank_code, callback_url, desc, provider, token, request_id}));

    var date = new Date();
    var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
    date = new Date(aestTime);
    logger.info('create_payment Ho_Chi_Minh time: '+date.toLocaleString(), { ctx: 'Zalopay Create'})
    var vnp_CreateDate = dateFormat(date, 'yyyymmddHHMMss');
    var date_token = dateFormat(date, 'yyyy-mm-dd');
    const items = [
      {
        itemid: '',
        itemname: '',
        itemprice: money,
        itemquantity: 1
      }
    ];
  const transaction = {
    /**
     * Required
     */
    app_user: 'demo',
    amount: money,
    items,
    bankcode: bank_code,
    description: desc,
    order_type: 'GOODS', // Loại đơn hàng:GOODS, TRANSPORTATION, HOTEL, FOOD, TELCARD, BILLING. Mặc định là GOODS.
    /**
     * Embed Data (Optional)
     */
    redirecturl: `${redirect_domain}/api/zalopay/redirect/${date_token}-${provider.name}-${request_id}`, // Redirect về url này sau khi thanh toán trên cổng ZaloPay (override redirect url lúc đăng ký app với ZaloPay)
    columninfo: {token}, // Thêm thông tin hiển thị ở phần Quản lý giao dịch chi tiết trên Merchant site, nếu cột chưa tồn tại cần vào phần Cài đặt hiển thị dữ liệu để cấu hình
    campaigncode: '', // Dùng để triển khai chương trình khuyến mãi
    zlppaymentid: '', // Mã thông tin thanh toán
    /**
     * Optional
     */
    callback_url: `${redirect_domain}/api/zalopay/ipn/${date_token}-${provider.name}-${request_id}`, // Zalopay sẽ thông báo trạng thái thanh toán của đơn hàng khi thanh toán hoàn tất; callback_url được gọi để thông báo kết quả thanh toán thất bại hoặc thành công. Nếu không được cung cấp, callback_url mặc định của ứng dụng sẽ được sử dụng.
    product_code: '', // Loại API mà đối tác sử dụng: ESCROW, QR, DIRECT, AGREEMENT
    device_info: {}, // Chuỗi JSON mô tả thông tin của thiết bị
    title: '', // Tiêu đề đơn hàng.
    phone: '', // Số điện thoại của người dùng
    email: '', // Email của người dùng
    address: '' // Địa chỉ của người dùng
  };
  logger.info({transaction},{ ctx: 'Zalopay Create'});
  const jdata = await createTransaction({config, transaction } );
  console.log(JSON.stringify(jdata));
  if(jdata &&  jdata.return_code === 1){
      return {
        error: 0,
        link: jdata.order_url,
        app_trans_id:jdata.app_trans_id,
        transaction_id: jdata.app_trans_id,
    }
  }else{
       return {
            error:1
        }
  }
}


async function create_test(){
  const config = require('../conf/zalopay_config.json');
  await create_payment({config, request_id:"123123", money:10000, bank_code:'', callback_url:'', desc:'Thanh toan', provider:'aicc', customer_id:'12', token:'123123'});
    
}   

async function schedule_check_transaction(){
  var date = new Date();
  var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
  date = new Date(aestTime);
  // console.log('Ho_Chi_Minh time: '+date.toLocaleString())
  var root_path = dateFormat(date, 'yyyy/mm/dd/');
  let list_file  = await list_folder('vbee-payment-log',root_path,'/');
  let files = []
  for(let item of list_file.Contents){
    // console.log(`File ${item.Key}`);
    files.push(item.Key);
  }

  let files_info = await  Promise.all(files.map(file_name=> {
            return get_object_from_s3('vbee-payment-log', file_name);
  }));
  for(let f of files_info){
    
    let item = JSON.parse(f.toString('utf-8'));
    if(!item  || item.partner !='zalopay' ){
      continue;
    }
    if(item.ipn == 1){
      // console.log(`Item này đã nhận callback từ IPN rồi`,JSON.stringify(item));
      continue;
    }
    let {request_timespan} = item;
    if(!request_timespan) continue;
    

    let time_process = new Date().getTime();
    request_timespan = request_timespan/1000;
    time_process = time_process/1000;

    if(time_process > request_timespan + 15*60){
      console.log(`Request này quá time xử lý`, JSON.stringify(item));
      continue;
    }
    
    console.log('files_info ', f.toString('utf-8'));
    let config_channel = await get_config_channel({channel: item.channel})
    if(!config_channel) continue;
    let zalo_config = getConfig(config_channel);
    console.log('config_channel', JSON.stringify(config_channel));
    let info = await getTransactionStatus({config:zalo_config, app_trans_id:item.app_trans_id});
    console.log('info', JSON.stringify(info));
    if(!info.is_processing && info.return_code == 1 ){
      //cập nhật lên S3 status mới
      item.state = TRANSACTION_STATE.SUCCESS;
      //save lại vào s3
      let jwt_info = await verified_token({token: item.token});
      if(!jwt_info) continue;
      let {
          date, uuid, provider
      } = jwt_info;
      let file_name = `${date}/${provider}-${uuid}.txt`;
      await upload_data(bucket_name,file_name, JSON.stringify(item));
      //update lên google sheet 
      await updateSheetByKey({sheet_id:google_sheet_report, keys:{request_id:uuid }, items:{state:item.state}});
    }
    //check transaction sang been zalopay
    // 
  }
}

async function getTransactionsStatus({ config, transactions }) {
  const params = transactions.map((transaction) => {
    const obj = {
      config,
      app_trans_id: transaction.appTransId
    }
    return obj;
  })
  const infos = await batchRequest(getTransactionStatus, params, BATCH_SIZE);

  const result = infos.map((info) => {
    const { transactionId, return_code, is_processing, amount } = info;
    return {
      transactionId,
      recheckMoney: return_code === 1 ? amount : 0,
      recheckState: return_code === 1 ? TRANSACTION_STATE.SUCCESS : TRANSACTION_STATE.FAILED,
      isRecheckFinal: !is_processing,
    }
  })

  return result;
}

module.exports = {
   create_payment,
   verified_data,
   getConfig,
   schedule_check_transaction,
   getTransactionStatus,
   getTransactionsStatus,
};

// (async function () {
// //   //lấy danh sách file trong ngày
//     let config_channel = await get_config_channel({channel: 'aicc'})
//     // if(!config_channel) continue;
//     let zalo_config = getConfig(config_channel);
//     console.log('config_channel', JSON.stringify(config_channel));
//     let info = await getTransactionStatus({config:zalo_config, app_trans_id:'21081702765267'});
//     console.log('info', JSON.stringify(info));

//   // await schedule_check_transaction();
//   // console.log(JSON.stringify(list_file));
//   // await create_test();
// })().then(() => {
//     process.exit();
// });   