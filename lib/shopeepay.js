/* eslint-disable */
var dateFormat = require('dateformat');
const { v4: uuid } = require('uuid');

const crypto = require('crypto');
const CryptoJS = require('crypto-js');
let fetch = require('node-fetch');

const { v4: uuidv1 } = require('uuid');
const path_gw = "/gw_payment/transactionProcessor"

let { request_info } = require('./utils');
const logger = require('../utils/logger');
const batchRequest = require('../utils/batchRequest');
const { BATCH_SIZE, TRANSACTION_STATE } = require('../constants');

function getConfig(config){

  return {
    "host":'api.uat.wallet.airpay.vn',
    "secret":'3aea489e899b42e79dfab05fde6e4a66',
    "client_id":11000261,
    "store_ext_id": "Vbee_01",
    "merchant_ext_id": "Vbee_10379193",
  }
} 

async function getInfotransaction({orderId}){
   
    let requestType = "transactionStatus";
    var requestId = uuidv1()
    //accessKey=$accessKey&orderId=$orderId&partnerCode=$partnerCode&requestId=$requestId
    // var rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`

    var rawSignature = `partnerCode=${partnerCode}&accessKey=${accessKey}&requestId=${requestId}&orderId=${orderId}&requestType=${requestType}`
    //puts raw signature
    console.log("--------------------RAW SIGNATURE----------------")
    console.log(rawSignature)
    //signature

    var signature = crypto.createHmac('sha256', serectkey)
                       .update(rawSignature)
                       .digest('hex');
    console.log("--------------------SIGNATURE----------------")
    console.log(signature)
    let jdataInfo =  {
      partnerCode,
      requestId,
      orderId,
      signature,
       "requestType": "transactionStatus",
  }

     let request = await request_info({ hostname,
            port:443,
            path:path_gw,
            method:'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body:jdataInfo})
     console.log('request', JSON.stringify(request));
    return request;

}

async function create_payment({config, money, bank_code, callback_url, desc, provider, token, request_id}){
    const unixtime = new Date().getTime() / 1000;
    const {secretKey, clientId, domain, storeExtId, merchantExtId}   = config;
    var date = new Date();
    var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
    date = new Date(aestTime);
    money = money * 100;
    var date_token = dateFormat(date, 'yyyy-mm-dd');

    let body_text = `{
      "request_id": "${request_id}",
      "store_ext_id": "${storeExtId}",
      "merchant_ext_id": "${merchantExtId}",
      "amount": ${money},
      "additional_info": "",
      "currency": "VND",
      "payment_reference_id": "${date_token}-${provider.name}-${request_id}"
      }`
    let hash = CryptoJS.HmacSHA256(body_text, secretKey)
    let sig = CryptoJS.enc.Base64.stringify(hash).replace(/\n+$/, '')
    logger.info({ body_text, sig, clientId, domain }, { ctx: 'Shoppepay Create'});
    let request =  await fetch(`https://${domain}/v3/merchant-host/qr/create`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Airpay-ClientId': clientId,
            'X-Airpay-Req-H': sig
          },
          body: body_text,
          method: 'POST',
        })
          .then(res => res.json())
          .catch(error => {
            // logger.info(`api_zabbix_sender_sum`, error)
            return null;
        })
    logger.info(`shopee create payment: ${JSON.stringify(request)}`, { ctx: 'Shopeepay Create'});
      if(request?.errcode == 0){
           const link = request.qr_url;
            return {
                error: 0,
                link,
                transaction_id: `${date_token}-${provider.name}-${request_id}`
            }

      }

     return {
            error:1
        }

}
async function verified_data({config, query, transaction}){
  let {requestId, amount,orderId, orderInfo, orderType, transId, message, responseTime, resultCode, payType, extraData, signature} = query;
  let {accessKey, partnerCode, serectkey, hostname} = config;
  var _rawSignature  =`accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
  var _signature = crypto.createHmac('sha256', serectkey)
                   .update(_rawSignature)
                   .digest('hex');
  console.log(_signature, '_signature', signature);

    if(_signature != signature){
        return {
            error: -1,
            error_msg: `Fail checksum`
        }
    }
    if(resultCode == '0' || parseInt(`${resultCode}`) == 0){
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

async function getTransactionStatus({config, transaction}) {
  const { domain, secretKey, clientId, merchantExtId, storeExtId } = config;
  const requestId = uuid();
  const url = `https://${domain}/v3/merchant-host/transaction/check`;
  const referenceId = transaction.transactionId || `${dateFormat(transaction.createdAt, 'yyyy-mm-dd')}-${transaction.provider.name}-${transaction._id}`;

  const bodyText = JSON.stringify({
    request_id: requestId,
    reference_id: referenceId,
    transaction_type: 13,
    merchant_ext_id: merchantExtId,
    store_ext_id: storeExtId,
    amount: transaction.money * 100,
  });
  let hash = CryptoJS.HmacSHA256(bodyText, secretKey)
  let sig = CryptoJS.enc.Base64.stringify(hash).replace(/\n+$/, '')

  let request =  await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-Airpay-ClientId': clientId,
          'X-Airpay-Req-H': sig
        },
        body: bodyText,
        method: 'POST',
      })
        .then(res => res.json())
        .catch(error => {
          console.log('err in fetch shopee url', error);
          return null;
      });
  return {...request, transactionId: transaction.transactionId};
}

async function getTransactionsStatus({config, transactions}) {
  const params = transactions.map((transaction) => {
    const obj = {
      config,
      transaction,
    }
    return obj;
  })
  const infos = await batchRequest(getTransactionStatus, params, BATCH_SIZE);

  const result = infos.map((info) => {
    const { transactionId, transaction } = info;
    let recheckState, recheckMoney, isRecheckFinal;
    switch (transaction?.status) {
      case 2:
        recheckState = TRANSACTION_STATE.PROCESSING;
        recheckMoney = 0;
        isRecheckFinal = false;
        break;
      case 3:
        recheckState = TRANSACTION_STATE.SUCCESS;
        recheckMoney = transaction.amount / 100;
        isRecheckFinal = true;
        break;
      case 4:
        recheckState = TRANSACTION_STATE.FAILED;
        recheckMoney = 0;
        isRecheckFinal = false;
        break;
      default:
        recheckState = TRANSACTION_STATE.PROCESSING;
        recheckMoney = 0;
        isRecheckFinal = false;
    }

    return {
      transactionId,
      recheckState,
      recheckMoney,
      isRecheckFinal,
    }
  });
  return result;
};

module.exports = {
   create_payment,
   verified_data,
   getConfig,
   getTransactionsStatus,
   getTransactionStatus,
};

//requestId=9cdaa140-fb63-11eb-bad4-158fdd1c85ea&amount=100000&orderId=9cda7a30-fb63-11eb-bad4-158fdd1c85ea&orderInfo=mua%20Thu&orderType=momo_wallet&transId=2564032391&message=Success&localMessage=Th%C3%A0nh%20c%C3%B4ng&responseTime=2021-08-12%2018:53:21&errorCode=0&payType=qr&extraData=merchantName=;merchantId=&signature=750861bc16d8ce078894a50d68d65726262cbb8e07d81831a1202be6ce7f8dd2
// (async function () {
//   // const unixtime = new Date().getTime() / 1000;
//   // let {secret, client_id, host}   = getConfig({});
//   // let body_text = `{
//   //   "request_id": "vbee_request_131231434323",
//   //   "store_ext_id": "Vbee",
//   //    "merchant_ext_id": "Vbee_012345",
//   //   "amount": 1000,
//   //   "additional_info": "",
//   //   "currency": "VND",
//   //   "payment_reference_id": "vbee_request_131231434323"
//   //   }`
//   // let hash = CryptoJS.HmacSHA256(body_text, secret)
//   // let sig = CryptoJS.enc.Base64.stringify(hash).replace(/\n+$/, '')
//   // let request =  await fetch(`https://${host}/v3/merchant-host/qr/create`, {
//   //       headers: {
//   //         'Content-Type': 'application/json',
//   //         'X-Airpay-ClientId': client_id,
//   //         'X-Airpay-Req-H': sig
//   //       },
//   //       body: body_text,
//   //       method: 'POST',
//   //     })
//   //       .then(res => res.json())
//   //       .catch(error => {
//   //         // logger.info(`api_zabbix_sender_sum`, error)
//   //         return null;
//   //     })
//   //   let qr_url = "";     
//   //   if(request.errcode == 0){
//   //        qr_url = request.qr_url;
//   //   }

//   //    console.log('request',qr_url,  JSON.stringify(request));
//   const money = 100000;
//   const request_id = uuid();
//   const provider = "shopee";
//   let info = await create_payment({money, request_id})
//   console.log(JSON.stringify(info));
//   // pm.variables.set('signature', sig)


// })().then(() => {
//     process.exit();
// });   

