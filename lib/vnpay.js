/* eslint-disable */
var dateFormat = require('dateformat');
var querystring = require('qs')
var sha256 = require('sha256');
var md5 = require('md5');
var crypto = require("crypto");    
const axios = require('axios'); 
let {
    sortObject,
    getNextIdByKey,
} = require('./utils');
const logger = require('../utils/logger');
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


function sortObjectV21(obj) {
    var sorted = {};
    var str = [];
    var key;
    for (key in obj){
        if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}


async function create_payment({config, money, bank_code, callback_url, desc, provider, token, request_id, redirect_domain}){
    const vnp_Version =  '2.0.0';
    const vnp_CurrCode =  'VND';
    const vnp_Command =  'pay';
    const vnp_OrderInfo =  desc || 'ThanhToan';
    const vnp_OrderType =  'topup';
    const vnp_Locale =  'vn';    
    var date = new Date();
    var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
    date = new Date(aestTime);
    logger.info('create_payment Ho_Chi_Minh time: '+date.toLocaleString(), { ctx: 'Vnpay Create'})
    var vnp_CreateDate = dateFormat(date, 'yyyymmddHHMMss');
    var date_token = dateFormat(date, 'yyyy-mm-dd');
    let vnp_TxnRef = await getNextIdByKey({});
    console.log('vnp_TxnRef', vnp_TxnRef);
    if(!vnp_TxnRef){
        return {
            error:1
        }
    }
    
    let vnp_Amount = money * 100;
    let vnp_BankCode  = bank_code || null;
    const vnp_IpAddr = process.env.IP_REQUEST || 'A';
    vnp_TmnCode = config.tmnCode;
    let vnp_ReturnUrl  = `${redirect_domain}/api/vnpay/redirect/${date_token}-${provider.name}-${request_id}`;
    // vnp_ReturnUrl = 'http%3A%2F%2Flocalhost%3A8888%2Forder%2Fvnpay_return';
    const secretKey = config.secretKey;

    let vnpUrl = config.url;

    var vnp_Params = {vnp_Version, vnp_Command, vnp_TmnCode, 
                        vnp_Locale, vnp_CurrCode, vnp_TxnRef, vnp_OrderInfo,vnp_BankCode,
                        vnp_OrderType, vnp_Amount, vnp_ReturnUrl, vnp_IpAddr, vnp_CreateDate};

    if(vnp_TmnCode === 'AICLIP01'){
            vnp_Params['vnp_Version'] = '2.1.0';
    }

    let vnv21 = sortObjectV21(vnp_Params);

    vnp_Params = sortObject(vnp_Params);
    
    console.log('config vnpay', secretKey, JSON.stringify(config), 'vnp_Params', JSON.stringify(vnp_Params));
    var signData = secretKey + querystring.stringify(vnp_Params, { encode: false });

    var secureHash = sha256(signData);
     
    

    if(vnp_TmnCode === 'AICLIP01'){
        var hmac = crypto.createHmac("sha512", secretKey);
        secureHash = hmac.update(new Buffer(querystring.stringify(vnv21, { encode: false }), 'utf-8')).digest("hex"); 
        
        delete vnp_Params['vnp_SecureHashType'];
    }


    if(vnp_TmnCode === 'VBEEVN01'){
        secureHash = md5(signData);
    }else{
        vnp_Params['vnp_SecureHashType'] =  'SHA256';
    }


    vnp_Params['vnp_SecureHash'] = secureHash;
    vnv21['vnp_SecureHash'] = secureHash;
    if(vnp_TmnCode === 'AICLIP01'){
        delete vnv21['vnp_SecureHashType'];
        console.log('vnp_Params', JSON.stringify(vnv21))
        vnpUrl += '?' + querystring.stringify(vnv21, { encode: false });
    }else{
        console.log('vnp_Params', JSON.stringify(vnp_Params))
        vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: true });
    }
    
    
    
    //Neu muon dung Redirect thi dong dong ben duoi
    
    logger.info(`vnpUrl: ${vnpUrl}`, { ctx: 'Vnpay Create'});
    return {
        error: 0,
        vnpay_id: vnp_TxnRef,
        link: vnpUrl,
        transaction_id: vnp_TxnRef,
    }
}


/*
router.get('/vnpay_ipn', function (req, res, next) {
    var vnp_Params = req.query;
    var secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    var config = require('config');
    var secretKey = config.get('vnp_HashSecret');
    var querystring = require('qs');
    var signData = querystring.stringify(vnp_Params, { encode: false });
    var crypto = require("crypto");     
    var hmac = crypto.createHmac("sha512", secretKey);
    var signed = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");     
     

    if(secureHash === signed){
        var orderId = vnp_Params['vnp_TxnRef'];
        var rspCode = vnp_Params['vnp_ResponseCode'];
        //Kiem tra du lieu co hop le khong, cap nhat trang thai don hang va gui ket qua cho VNPAY theo dinh dang duoi
        res.status(200).json({RspCode: '00', Message: 'success'})
    }
    else {
        res.status(200).json({RspCode: '97', Message: 'Fail checksum'})
    }
});

*/

async function verified_data({config, query, transaction}){
    let vnp_Params = query;
    console.log('check sum vnpay', JSON.stringify(vnp_Params));
    let {vnp_TransactionNo} = vnp_Params;
    let secureHash = vnp_Params['vnp_SecureHash'];
    let vnp_ResponseCode  = vnp_Params['vnp_ResponseCode'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];
 
    console.log('vnpay verified_data config', JSON.stringify(config));
    let checkSum = "";
    const { tmnCode, secretKey } = config;

    if(tmnCode === 'AICLIP01'){
        vnp_Params = sortObjectV21(vnp_Params);
        var signData = querystring.stringify(vnp_Params, { encode: false });
        var hmac = crypto.createHmac("sha512", secretKey);
        checkSum = hmac.update(new Buffer(signData, 'utf-8')).digest("hex");  
        console.log('checkSum v2.0.1', checkSum);   

    }else{
        vnp_Params = sortObject(vnp_Params);
        console.log('querystring', vnp_Params)
        let signData = secretKey + querystring.stringify(vnp_Params, { encode: false });
        checkSum = sha256(signData);
        if(tmnCode === 'VBEEVN01'){
            checkSum = md5(signData);
        }
    }
    logger.info(`vnpay checksum: ${checkSum} ${secureHash}`, {ctx: 'Vnpay verify_data'});
    if(secureHash != checkSum){
        return {
            error: -1,
            error_msg: `Fail checksum`
        }
    }
    return {
            error: 0,
            error_msg: `Thành Công`
        }

    // if(vnp_ResponseCode == '00' || parseInt(`${vnp_ResponseCode}`) == 0){
    //     return {
    //         error: 0,
    //         error_msg: `Thành Công`
    //     }
    // }
    // return {
    //     error: 1,
    //     error_msg: `Thanh toán không thành công`
    // }

}
function getConfig(config){

  return {
    "vnp_TmnCode":config['vnp_TmnCode'],
    "vnp_HashSecret":config['vnp_HashSecret'],
    "vnp_Url":config['vnp_Url']
  }
} 

async function getTransactionStatus({ config, transactionId, transactionDate }) {
    const { url, tmnCode, secretKey } = config;
    const date = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
    let vnp_Params = {
        vnp_Version: '2.0.0',
        vnp_Command: 'querydr',
        vnp_TmnCode: tmnCode,
        vnp_TxnRef: transactionId,
        vnp_OrderInfo: 'query',
        vnp_TransDate: transactionDate,
        vnp_CreateDate: dateFormat(date, 'yyyymmddHHMMss'),
        vnp_IpAddr: '123.123.123.123'
    };

    if(tmnCode === 'AICLIP01'){
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params = sortObjectV21(vnp_Params);
        const hmac = crypto.createHmac("sha512", secretKey);
        secureHash = hmac.update(new Buffer(querystring.stringify(vnp_Params, { encode: false }), 'utf-8')).digest("hex");
        vnp_Params['vnp_SecureHash'] = secureHash;
    }
    else if (tmnCode === 'VBEEVN01') {
        vnp_Params = sortObject(vnp_Params);
        vnp_Params['vnp_SecureHashType'] = 'MD5';
        vnp_Params['vnp_SecureHash'] = md5(secretKey + querystring.stringify(vnp_Params, { encode: false }));
    } else {
        vnp_Params = sortObject(vnp_Params);
        vnp_Params['vnp_SecureHashType'] = 'SHA256';
        vnp_Params['vnp_SecureHash'] = sha256(secretKey + querystring.stringify(vnp_Params, { encode: false }));
    }
    console.log('vnp params',querystring.stringify(vnp_Params));
    const vnpUrl = `${url}?${querystring.stringify(vnp_Params)}`;
    const res = await axios.get(vnpUrl);
    return vnpUrl;
};

async function getTotalSuccess({ config, transactions }) {
    
};

module.exports = {
   create_payment,
   verified_data,
   getConfig,
   getTransactionStatus,
   getTotalSuccess,
};

// let config_vbee  = {
//   "vnp_TmnCode":"VBEEVN01",
//   "vnp_HashSecret":"ZWMBSRFLELXZBECOCZYZIKBJVJTGOBFO",
//   "vnp_Url":"https://pay.vnpay.vn/vpcpay.html",
//   "vnp_ReturnUrl": "https://apicall.vbeecore.com/api/vnpt/vnpay_return"
// };
//create_payment({config, money, bank_code, callback_url, desc, provider, token, request_id})

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
//     // console.log(await verified_data(query));
//     let money=100000, bank_code="NCB", callback_url = config_vbee.vnp_ReturnUrl, desc="ThanhToan", provider="aicc", token="", request_id = "";
//     console.log(await create_payment({config: config_vbee, money, bank_code, callback_url, desc, provider, token, request_id}));
// })().then(() => {
//     process.exit();
// });   

