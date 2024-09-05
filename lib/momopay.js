/* eslint-disable */
var dateFormat = require('dateformat');
const crypto = require('crypto');


const { v4: uuidv1 } = require('uuid');
const path_gw = "/gw_payment/transactionProcessor"

let { request_info } = require('./utils');

const logger = require('../utils/logger');

function getConfig(config){

  return {
    "partnerCode":config['momo partnerCode'],
    "accessKey":config['momo accessKey'],
    "serectkey":config['momo serectkey'],
    "hostname":config['momo hostname'],
    "redirect_domain": config['redirect_domain'],
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

async function create_payment({config, money, bank_code, callback_url, desc, provider, token, request_id, redirect_domain}){
    let { accessKey, partnerCode, secretKey, hostname, storeId } = config;
    var date = new Date();
    var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
    date = new Date(aestTime);
    logger.info('create_payment Ho_Chi_Minh time: '+date.toLocaleString(), { ctx: 'Momopay Create'})
    var vnp_CreateDate = dateFormat(date, 'yyyymmddHHMMss');
    var date_token = dateFormat(date, 'yyyy-mm-dd');
    var orderInfo = desc
    var redirectUrl = `${redirect_domain}/api/momopay/redirect/${date_token}-${provider.name}-${request_id}`
    var amount = `${money}`
    var orderId = uuidv1()
    let ipnUrl =  `${redirect_domain}/api/momopay/ipn`;
    var requestId = request_id
    var requestType = "captureWallet"
    var extraData = token //pass empty value if your merchant does not have stores else merchantName=[storeName]; merchantId=[storeId] to identify a transaction map with a physical store
    let rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    //puts raw signature
    console.log("--------------------RAW SIGNATURE----------------")
    logger.info(`rawSignature ${rawSignature}`, { ctx: 'Momopay Create' });
    //signature

    var signature = crypto.createHmac('sha256', secretKey)
                       .update(rawSignature)
                       .digest('hex');
    console.log("--------------------SIGNATURE----------------")
    console.log(signature)
    let jdataInfo =  {
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        extraData,
        ipnUrl,
        requestType,
        signature,
        storeId
    }
     let request = await request_info({ hostname,
            port:443,
            path:`/v2/gateway/api/create`,
            method:'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body:jdataInfo})
     logger.info(`request ${JSON.stringify(request)}`, { ctx: 'Momopay Create' });

     if(request.resultCode == 0){
         return {
          error: 0,
          link: request.payUrl,
          transaction_id: orderId,
      }
     }
     return {
            error:1
        }

}
async function verified_data({config, query, transaction}){
  let {requestId, amount,orderId, orderInfo, orderType, transId, message, responseTime, resultCode, payType, extraData, signature} = query;
  const { accessKey, partnerCode, secretKey, hostname} = config;
  var _rawSignature  =`accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
  var _signature = crypto.createHmac('sha256', secretKey)
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

async function getTransactionStatus({config, requestId, orderId}){
  const { partnerCode, accessKey, secretKey, hostname } = config;
  const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  const jdataInfo = {
    partnerCode,
    requestId,
    orderId,
    signature,
    lang: 'en'
  };

  const response = await request_info({ 
    hostname, 
    port: 443, 
    path: '/v2/gateway/api/query',
    method: 'POST',
    body: jdataInfo,
  });
  console.log('response = ', response);
  if (response.resultCode === 0)
    return {
      error: 0,
    };
  else 
    return { error: 1};
}

async function getTotalSuccess({config, transactions}) {
  return {};
};

module.exports = {
   create_payment,
   verified_data,
   getConfig,
   getTransactionStatus,
   getTotalSuccess,
};

//requestId=9cdaa140-fb63-11eb-bad4-158fdd1c85ea&amount=100000&orderId=9cda7a30-fb63-11eb-bad4-158fdd1c85ea&orderInfo=mua%20Thu&orderType=momo_wallet&transId=2564032391&message=Success&localMessage=Th%C3%A0nh%20c%C3%B4ng&responseTime=2021-08-12%2018:53:21&errorCode=0&payType=qr&extraData=merchantName=;merchantId=&signature=750861bc16d8ce078894a50d68d65726262cbb8e07d81831a1202be6ce7f8dd2
// (async function () {
//     // let request  = await create_payment({money:100000, bank_code:'NCD', callback_url:'https://vn', desc:'mua Thu', provider:'aicc', token:'', request_id:uuidv1()});
//     // console.log(request);
//     // await getInfotransaction({orderId:'9cda7a30-fb63-11eb-bad4-158fdd1c85ea'});
//    let query = {
    //       partnerCode: 'MOMO1T8G20210628',
    //       orderId: '2b6ed3e0-fcd1-11eb-8b7c-311ed94cd6ff',
    //       requestId: '1b8209a8-fa20-43e7-93ed-5f2dc9c16f7f',
    //       amount: 50000,
    //       orderInfo: 'Gói trả trước',
    //       orderType: 'momo_wallet',
    //       transId: 1628926101199,
    //       resultCode: 1006,
    //       message: 'Transaction denied by user.',
    //       payType: '',
    //       responseTime: 1628926101199,
    //       extraData: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm92aWRlciI6InZiZWUiLCJkYXRlIjoiMjAyMS8wOC8xNCIsInV1aWQiOiIxYjgyMDlhOC1mYTIwLTQzZTctOTNlZC01ZjJkYzljMTZmN2YiLCJpYXQiOjE2Mjg5MjYwODcsImV4cCI6MTY2MDQ2MjA4N30.ZRJZ8VpXo8w7RosL4ohC4Kdh560Vn93RN5bgkCRYnAH8qSB0tCy0ax-Dp6_SQKbtWFbkaBdcOlgUHXdpnub4PA',
    //       signature: '3cad745a217bd1e97fbbf247cb827f722409c799ff3c1199ae14ac3861273843'
    //     }
    // console.log('momopay_ipn', query);
    // let token  = query.extraData;
    // let jwt_info = await verified_token({token});
    // if(!jwt_info) return {
    //             statusCode: 200,
    //             body: JSON.stringify(
    //               {
    //                 returncode: 2, returnmessage: `Thông tin không đúng`
    //               },
    //               null,
    //               2
    //             ),
    //           };    

    // let {
    //     date, uuid, provider, channel
    // } = jwt_info;
    // let file_name = `${date}/${provider}-${uuid}.txt`;
    // let s3data = await  get_object_from_s3(bucket_name,file_name);
    // if(!s3data) return {error: 1, error_msg:`File remove Request Expire!`}
    // let info  = JSON.parse(s3data.toString('utf-8'));
    // let config_channel = await get_config_channel({channel: info.channel})

    // console.log('momopay_ipn', s3data.toString('utf-8'), JSON.stringify(query));
    // let verified = await verified_data({config:getConfig(config_channel), query, order:info});
    // console.log('momopay_ipn verified', verified);
    

// })().then(() => {
//     process.exit();
// });   

