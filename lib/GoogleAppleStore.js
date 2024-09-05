/* eslint-disable */
var dateFormat = require('dateformat');
const { v4: uuid } = require('uuid');
const { decodeNotificationPayload, Environment, NotificationType, decodeTransaction, NotificationSubtype, decodeRenewalInfo } = require('app-store-server-api');
const GoogleReceiptVerify = require('google-play-billing-validator')
const ServiceAccount = {
}


const productIds = ['vbee_tts_studio_adv_month','vbee_tts_studio_pro_month','vbee_tts_studio_adv_year','vbee_tts_studio_pro_year']
const packageName = 'vn.vbee.tts';

let { getNextIdByKey, request_info } = require('./utils');

const transactionService = require('../services/transaction');
const { ERROR_CODE } = require('../errors/code');
const { PARTNER_NAME } = require('../constants');
const CustomError = require('../errors/CustomError');
const logger = require('../utils/logger');
const { NODE_ENV } = require('../configs');
const { verifyReceipt, getTransactionInfoFromReceipt } = require('./apple');

/*
Ngân hàng

NCB

Số thẻ

9704198526191432198

Tên chủ thẻ

NGUYEN VAN A

Ngày phát hành

07/15

Mật khẩu OTP

123456
*/

function match_all(re, data, count = 1){
        var m;
        let l = [];
        do {
                m = re.exec(data);
                if (m) {
                        let s = "";
                        for(let i = 0; i < count; i++){
                                s += m[i+1] + "|";
                        }
                        l.push(s.slice(0, s.length - 1));
                }
        } while (m);
        return l;
}
function export_acb(text){
    let regex = new RegExp(`[\+]+[ ]+([0-9,]+)[ ]+luc`,'g');
    let results = match_all(regex, text, 1);
    console.log(results);   
    if(results.length <= 0) return {error: 1 };
    const money = results[0];

    let pos = text.indexOf('GD:');
    if(pos === -1) return {error: 1 };;

    return {
        money: parseInt(`${money}`.replace(/,/g,"")),
        desc: text.substring(pos)
    }
}
function export_mb(text){
    let regex = new RegExp(`[\+]+([0-9,]+)VND`,'g');
    let results = match_all(regex, text, 1);
    console.log('export_mb', JSON.stringify(results));  
    if(results.length <= 0) return {error: 1 };;
    const money = results[0];

    let pos = text.indexOf("ND:");
    if(pos === -1) return {error: 1 };;

    return {
        money: parseInt(`${money}`.replace(/,/g,"")),
        desc: text.substring(pos)
    }

}

function export_tpbank(text){
    let regex = new RegExp(`PS\:[ ]*[\+\-]+([0-9\.]+)`,'g');
    let results = match_all(regex, text, 1);
    console.log(results);   
    if(results.length <= 0) return {error: 1 };;
    const money = results[0];

    let pos = text.indexOf("ND:");
    if(pos === -1) return {error: 1 };;

    return {
        money: parseInt(`${money}`.replace(/\./g,"")),
        desc: text.substring(pos)
    }

}

function export_vcb(text){
    let regex = new RegExp(`[\+]+([0-9,]+)VND[ ]+luc`,'g');
    let results = match_all(regex, text, 1);
    console.log(results);   
    if(results.length <= 0) return {error: 1 };;
    const money = results[0];

    let pos = text.indexOf("VND. Ref");
    if(pos === -1) return {error: 1 };;

    return {
        money: parseInt(`${money}`.replace(/,/g,"")),
        desc: text.substring(pos)
    }

}
function export_techcombank(text){
    let regex = new RegExp(`GD\:[\+\-]+([0-9,]+)`,'g');
    let results = match_all(regex, text, 1);
    console.log(results);   
    if(results.length <= 0) return {error: 1 };;
    const money = results[0];

    let regexSoDu = new RegExp(`(So du\:[0-9,]+)`,'g');
    results = match_all(regexSoDu, text, 1);

    if(results.length <= 0) return {error: 1 };;
    const text_sd = results[0];
    console.log(results);
    let pos = text.indexOf(text_sd);
    if(pos === -1) return {error: 1 };;

    return {
        money: parseInt(`${money}`.replace(/,/g,"")),
        desc: text.substring(pos + text_sd.length)
    }

}


function export_bidv(text){
    let regex = new RegExp(`[\+]+([0-9,]+)VND vao`,'g');
    let results = match_all(regex, text, 1);
    console.log(results);   
    if(results.length <= 0) return {error: 1 };;
    const money = results[0];

    let pos = text.indexOf("ND:");
    if(pos === -1) return {error: 1 };;

    return {
        money: parseInt(`${money}`.replace(/,/g,"")),
        desc: text.substring(pos)
    }

}

function export_info_sms(query){
    let {sender, message } = query;
    let {text } = message;
    let _money = null;
    let _desc = null;
    let jdata = null;
    let bank_name = '';
    if(sender.indexOf('acb') != -1){
        bank_name = 'ACB';
        jdata = export_acb(text);
    }
    if(sender.indexOf('tech') != -1){
        bank_name = 'TECH';
        jdata = export_techcombank(text);
    }
    if(sender.indexOf('tpbank') != -1){
        bank_name = 'TPBANK';
        jdata = export_tpbank(text);
    }
    

    if(sender.indexOf('mbbank') != -1){
        bank_name = 'MB';
        jdata = export_mb(text);
    
    }
    if(sender.indexOf('bidv') != -1){
        bank_name = 'BIDV';
        jdata = export_bidv(text);
    }
    if(sender.indexOf('vietcombank') != -1){
        bank_name = 'VCB';
        jdata = export_vcb(text);
    }

    if(jdata.error){
        return {
            error: 1,
            error_msg: `Không export được thông tin`

        }
    }
    let {money, desc } = jdata;
    return {
            error: 0,
            error_msg: `Thành Công`,
            money, 
            desc

        }
}

async function create_payment({config = {}, money, bank_code, callback_url, desc, provider, token, request_id}){
    var date = new Date();
    var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
    date = new Date(aestTime);
    logger.info('create_payment Ho_Chi_Minh time: '+date.toLocaleString(), { ctx: 'Appstore Create'})
    var vnp_CreateDate = dateFormat(date, 'yyyymmddHHMMss');
    var date_token = dateFormat(date, 'yyyy-mm-dd');
    

    let id_transaction = uuid();

    console.log('id_transaction', id_transaction);

    if(!id_transaction){
        return {
            error:1,
            error_msg: `Khởi tạo id giao dịch bị lỗi`
        }
    }
    let bank_info  = {}
    bank_info.code = id_transaction;
    return {
        error: 0,
        bank_info,
        appstore_transaction_id: id_transaction,
        transaction_id: id_transaction,
    }
}
async function verified_payment_google({purchaseToken, productId}){
    var googleReceiptVerify = new GoogleReceiptVerify({
          email: ServiceAccount.client_email,
          key: ServiceAccount.private_key
    });

     let response = await googleReceiptVerify.verifySub({
            packageName,
            productId,
            purchaseToken,
          }).catch(function(error) {
                  console.log(error);
                  return error;
                })

     console.log(JSON.stringify(response));     
     if (response.isSuccessful === true) {
        return {
            error: 0,
            transactionId: response.payload.orderId
        }
      } else {
        // error: validation not successful
        // console.log(response.errorMessage);
        return {
            error: 1
        }
      }

}
async function verified_apple_data({ config, query }) {
  logger.info(`verified_data: ${JSON.stringify(query)}`, { ctx: 'Appstore' });
  let { id_transaction, verification_data } = query;

  // Verify receipt
  const { error, data: receiptInfo } = await verifyReceipt(verification_data);
  if (error !== 0) return { error: 1 };

  // Find transaction
  const { appleOriginalTransactionId, appleTransactionId } = getTransactionInfoFromReceipt(receiptInfo);
  const transaction = await transactionService.findAppleTransactionForIPN({
    transactionId: id_transaction,
    appleTransactionId,
  });
  if (!transaction)
    throw new CustomError(
      ERROR_CODE.BAD_REQUEST,
      PARTNER_NAME.APP_STORE,
      `Order not found with id_transaction: ${id_transaction}, ${appleTransactionId}`,
    );

  return {
    error: 0,
    id_transaction,
    info: { ...transaction, appleOriginalTransactionId, appleTransactionId },
  };
}

async function verified_payment_apple(signedPayload) {
    // TODO: handle renewal subscription
    // Currently we only handle initial buy
    try {
        const notificationInfo = await decodeNotificationPayload(signedPayload);
        const { notificationType, subtype } = notificationInfo;
        const isInitialBuy =
          notificationType === NotificationType.Subscribed ||
          (notificationType === NotificationType.DidChangeRenewalPref &&
            subtype === NotificationSubtype.Upgrade);
        // if (!isInitialBuy) return { error: 0, data: null };

        const { environment } = notificationInfo.data;
        const isSameEnvironment = (environment === Environment.Sandbox && NODE_ENV === "dev") || (environment === Environment.Production && NODE_ENV === "prod");
        // if (!isSameEnvironment) return { error: 0, data: null };
    
        const transactionData = await decodeTransaction(notificationInfo.data.signedTransactionInfo);
        const renewalData = await decodeRenewalInfo(notificationInfo.data.signedRenewalInfo);

        console.log('notificationInfo = ', notificationInfo);
        console.log('transactionData = ', transactionData);
        console.log('renewal Data = ', renewalData);
        return { error: 0, data: transactionData };
    } catch (err) {
        console.log(err);
        return { error: 1, error_msg: err.message }
    }
};

function getConfig(config){

  return {
    "bank_prefix": ""
  }
} 

module.exports = {
   create_payment,
   verified_payment_google,
   verified_apple_data,
   verified_payment_apple,
   getConfig
};
// let query = {
//     "vnp_Amount": "5000000",
//     "vnp_BankCode": "VNPAY",
//     "vnp_CardType": "QRCODE",
//     "vnp_OrderInfo": "ThanhToan",
//     "vnp_PayDate": "20210813133513",
//     "vnp_ResponseCode": "24",
//     "vnp_SecureHash": "a2b0724a70d788dd277e96a1df1d246a93c1e309582720d4cdc146d9730bebf6",
//     "vnp_SecureHashType": "SHA256",
//     "vnp_TmnCode": "MOBIFO01",
//     "vnp_TransactionNo": "0",
//     "vnp_TxnRef": "43",
//     "money": 50000
// };
// (async function () {
//     // await list_folder('s3-music-background-5','2021/');
//     // await create_payment({query:{vnp_Amount:10000}});
//     console.log(await verified_data(query));
// })().then(() => {
//     process.exit();
// });   