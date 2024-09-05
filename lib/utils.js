/* eslint-disable */
let https = require('https')

const { v4: uuid } = require('uuid');
var AWS = require('aws-sdk');
var jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const config = require('./config.js');
const { 
  BUCKET_NAME: bucket_name, 
  S3_ID_LIB: accessKeyId, 
  S3_KEY_LIB: secretAccessKey, 
  GOOGLE_REPORT: google_sheet_report, 
  PUBLIC_DOMAIN 
} = require('../configs');
const logger = require('../utils/logger');

let fetch = require('node-fetch');
const axios = require('axios').default;
const list_bank_support = [
        ["1","ABBANK","Ngân hàng thương mại cổ phần An Bình (ABBANK)","https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/abbank.png"],
        ["2","ACB","Ngân hàng ACB","https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/acb.png"],
        ["3","AGRIBANK","Ngân hàng Nông nghiệp (Agribank)","https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/agribank.png"],
        ["4","BACABANK","Ngân Hàng TMCP Bắc Á",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/bacabank.png'],
        ["5","BIDV","Ngân hàng đầu tư và phát triển Việt Nam (BIDV)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/bidv.png'],
        ["6","DONGABANK","Ngân hàng Đông Á (DongABank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/dongabank.png'],
        ["7","EXIMBANK","Ngân hàng EximBank",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/eximbank.png'],
        ["8","HDBANK","Ngan hàng HDBank",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/hdbank.png'],
        ["10","MBBANK","Ngân hàng thương mại cổ phần Quân đội",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/mbbank.png'],
        ["11","MSBANK","Ngân hàng Hàng Hải (MSBANK)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/msb.png'],
        ["13","NCB","Ngân hàng Quốc dân (NCB)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/ncbbank.png'],
        ["14","OCB","Ngân hàng Phương Đông (OCB)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/ocb.png'],
        ["15","OJB","Ngân hàng Đại Dương (OceanBank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/oceanbank.png'],
        ["16","PVCOMBANK","Ngân hàng TMCP Đại Chúng Việt Nam",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/pvcombank.png'],
        ["17","SACOMBANK","Ngân hàng TMCP Sài Gòn Thương Tín (SacomBank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/sacombank.png'],
        ["18","SAIGONBANK","Ngân hàng thương mại cổ phần Sài Gòn Công Thương",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/saigonbank.png'],
        ["19","SCB","Ngân hàng TMCP Sài Gòn (SCB)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/scb.png'],
        ["20","SHB","Ngân hàng Thương mại cổ phần Sài Gòn - Hà Nội(SHB)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/shb.png'],
        ["21","TECHCOMBANK","Ngân hàng Kỹ thương Việt Nam (TechcomBank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/techcombank.png'],
        ["22","TPBANK","Ngân hàng Tiên Phong (TPBank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/tpbank.png'],
        ["23","VPBANK","Ngân hàng Việt Nam Thịnh vượng (VPBank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/vpbank.png'],
        ["24","SEABANK","Ngân Hàng TMCP Đông Nam Á",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/seabank.png'],
        ["25","VIB","Ngân hàng Thương mại cổ phần Quốc tế Việt Nam (VIB)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/vib.png'],
        ["26","VIETABANK","Ngân hàng TMCP Việt Á",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/vietabank.png'],
        ["27","VIETBANK","Ngân hàng thương mại cổ phần Việt Nam Thương Tín",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/vietbank.png'],
        ["28","VIETCAPITALBANK","Ngân Hàng Bản Việt",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/vietcapitalbank.png'],
        ["29","VIETCOMBANK","Ngân hàng Ngoại thương (Vietcombank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/vietcombank.png'],
        ["30","VIETINBANK","Ngân hàng Công thương (Vietinbank)",'https://vbee.s3.ap-southeast-1.amazonaws.com/images/banks/vietinbank.png'],
        ];

const publicDer =`-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKZQ60hER6FDfeZBuIM+PNm+aiCdYkld
cke1oyp9lKubY0MXrGFKsx/Q97/cX44yUlEa+yJBlGRxCTokgqExtmkCAwEAAQ==
-----END PUBLIC KEY-----`;

const privateDer =`-----BEGIN RSA PRIVATE KEY-----
MIIBOwIBAAJBAKZQ60hER6FDfeZBuIM+PNm+aiCdYkldcke1oyp9lKubY0MXrGFK
sx/Q97/cX44yUlEa+yJBlGRxCTokgqExtmkCAwEAAQJAcMULU7vgacsOkdLcHjlU
HzxKT4UHgMFY3KCfWw89gEFLOTPtanRnfNU68RklUOkh+JAdmLUbdVQ4dhEwDnN8
AQIhANatSgdiiD6PdIMr6ezOamTMT7uDJ5aPg9FSTe3ghJ+BAiEAxlSJVUu3MWa2
BEKf8W06wYwKbZhSlJ3h6Ss56qsBiukCICoFKWRgqQJ12fyC7/rmPHUWeNTfSzRx
SwAB+DcDp3IBAiEAtqCJhZ2fJ0JpQSsIlQv8GtWVlK26/VcU+9zuDAVD+mECIQCW
vTdTEIQ0mQMyyC9PaDELI3PJ4i90Xcvt11+ZAQ0siA==
-----END RSA PRIVATE KEY-----`;

function genTest({info = {}, expiresIn='1minute'}){
  const privateDer1 =`-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAzVjBMzfQE5So+Ww4jSyDE9iVmfjoDqxUYXBvfcB3LMhs8zE1
itZmA2OSA6PzRCN7SVz+bRwd1zWthggNU4kbFAObdp1LRvRuq0ew3YasCmXbDyDZ
KA5b8BtznAWJ6UfcyqUJvFBaZP406rZ1hhRWddMXzdyyXuhDMm9cabfuJ9d/dotl
EEXCnW3AVh165XA3gY5mSeFTL4BcKulyIBfeTNKhmhOKudSuXrzVbC3SrDJkrAvz
xcP0f7DdYxlylbwfnVrMwhQtAfKW7NZeJaqite18ZD7/yApt/aWiSRzGMxCOzWlN
Q54aWJPE7o986n/opjvB+Yt9cilAmhU2RxkxAQIDAQABAoIBAEZbrb7V1caPviHP
8cR1Rugq4n9iKGi2pSbJtnm401yVw7bD2puagFOS7zmuGDD1k018vnQ2GQdfDfiJ
k79Wj9+YqNDIbj1+jNjE9JXCifn6Ekepsp4l5Vxsm30O7MTwaXdJev957K8D5q+x
Gq15FHLEhDh18OvR2wxR2bEjY0dk0gBbac3vdF1X6Z+OFNZnt5tJWk2QHDgoz0ij
51Sa7xMsrjiZxKPHq+xG4GSDvoAk3S96iMNT8gd4kD/vS34OwjS5FV1T0FX1bfNN
dwvBTGea9V78bsW+osDN+21/vvzl+ZDI4y60dVQdNNWR4IFj04l/mHvLKoGN+Eem
Y8mfm90CgYEA/muSrkbKcSwCxb4C0IXjFE75ec+Qt/gkkDOCAWzxlrKjvDID4sTD
Th+gPVBRbAzP0AjaykEUwMGNqnFkxGTcALNVPCsoM4tCFyfVADQhglPRGiolewRh
K+iVnPgSyGOrhvHZK+gF5N6X9HTnZEdwIKyBPKJeRe8YI6sSzgLHwS8CgYEAzp8s
oWJZYAyq9ZV/LhEzQVRLMIGJwoik9epZJ9gkMnEKkcHaLFiRjlnfAxN1CBoHQhrS
Tn3wRcYQx2Kq/C2ihTqWGbAu9OraRZhvjLHcB5l3yzcsBkXZ4yfx6MCr6IeAxkAF
DhWE8QhEpzsAmRtnAgAw80WZ1pCMXddp+gAUxM8CgYEA5tAxAmq2vnVvDnaTlxng
KUx8iEYGxOAaS7hu+Vwc0NrAMLwvSku34+hNN1Lmi2AUKGfgFh109mqiWz8EbCgU
b45ChZOhpSFxlBBO7SBeRh5EVbhmyHPwtCUNlpp4b9P8iTBgFbUpo7lNojlss00c
LIhTtu6XGFsRS0qohL2A+4ECgYEAnP2+SGTUqbEWWICdYGA7RIEKnDFgfYmbZSoJ
UcfdQOI4+KSE47rr5XANjWXEP0Kfjy+X6YGxBSLH7ubeKbt2x6nLEHuYQgkLjWOU
Jh+hobiOl7402hNKyVi5anKya3xBcOCFtrzNBOKWX0XqX2q9qnyAtOaGS8wKiua4
o/ZZ0WsCgYEAhezni42fGV+j2pjSI4/+wknvCiB5I0KYG/2980nWpI12K4KW8WO5
c4WfZD2TPcu4roEfAANTThgLl9+atb6jR5ZrqY6d6rv72kjtCHMw3+Bze3e0pjjs
SqxpCGRFKGVy6aW9s4KUlSvTizu514uxPKqnDJVgNEphrIv82xVuqM4=
-----END RSA PRIVATE KEY-----`;
 return   jwt.sign(info, privateDer1, { algorithm: 'RS256',  expiresIn});
}

async function send_post_data({ url, body }){
  console.log(`send_post_data`, JSON.stringify({ url, body }));
  return await fetch(url, {
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    method: 'POST',
  })
    .then(res => res.json())
    .catch(error => {
      logger.error(error, {ctx: 'SendPostData'});
      return null;
  });
}

function htmlResponse({statusCode = 500, message, link}){
    return {
                statusCode,
                "body": `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta http-equiv="refresh" content="2; url='${link||PUBLIC_DOMAIN}'" />
  <meta name="viewport"
        content="user-scalable=no,initial-scale=1,maximum-scale=1,minimum-scale=1,width=device-width,height=device-height">
  <meta name="theme-color" content="#152944">
  <title>VBEE Payment Gateway</title>
     

      <style>
      .loading-wrap-index {
              display: flex;
              flex-flow: column wrap;
              justify-content: center;
              align-items: center;
              margin: 100px 0;
              /* loading gif wrap */
            }
            .loading-wrap-index .loading-gif-wrap {
              width: 145px;
              height: 145px;
              background-color: #7a8593;
              display: flex;
              flex-flow: column nowrap;
              justify-content: center;
              align-items: center;
              border-radius: 4px;
            }
            .loading-wrap-index .loading-gif-wrap .loading-gif {
              margin-top: 20px;
              width: 40px;
              image-rendering: initial;
            }
            .loading-wrap-index .loading-message {
              margin-top: 20px;
              text-align: center;
              font-size: 13px;
            }
      </style>
</head>
<body>
<div id="root" class="notranslate">
  <div class="loading-wrap-index">
    <div class="loading-gif-wrap">
      <img 
        src="data:image/png;base64, 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" 
        alt="logo zalopay" 
        class="logo-zalopay" 
        style="width: 80px;"
      >
      <img src="https://sbgateway.zalopay.vn/build/image/loading.gif" alt="loading" class="loading-gif">
    </div>
    <div class="loading-message">
      <p>Giao dịch đang được xử lý. Vui lòng chờ trong giây lát</p>
      <p>Nếu hệ thống không tự chuyển vui lòng nhấn vào đây <a href="${link||PUBLIC_DOMAIN}">this link</a>.</p>
    </div>
  </div>
</div>
</body>
</html><html>`,
                "headers": {
                    'Content-Type': 'text/html',
            }
        }
}
function gen_access_token({info, expiresIn = '1minutes'}){
  return   jwt.sign(info, privateDer, { algorithm: 'RS256',  expiresIn});
}
async function verified_token({token, publicKeyRsa}){
    if(!publicKeyRsa) publicKeyRsa = publicDer;
    return new Promise(resolve =>{
      try{
          jwt.verify(token, publicKeyRsa, function(err, decoded) {
          if(err){
            resolve(null);
          }else{
            resolve(decoded);
          }
        });    
      }catch(e){
        resolve(null);
      }
        
    });
}


async function syncDataGoogleSheet({sheet_id, headers, rows}) {
    
    return await fetch(`https://4ac6qsel8e.execute-api.ap-southeast-1.amazonaws.com/dev/sync_google_sheet`, {
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sheet_id, headers, rows}),
        method: 'POST',
      })
        .then(res => res.json())
        .catch(error => {
          // logger.info(`api_zabbix_sender_sum`, error)
          return null;
      })     
}

async function updateSheetByKey({sheet_id, keys, items}) {
    
    return await fetch(`https://4ac6qsel8e.execute-api.ap-southeast-1.amazonaws.com/dev/update_sheet_by_key`, {
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sheet_id, keys, items}),
        method: 'POST',
      })
        .then(res => res.json())
        .catch(error => {
          // logger.info(`api_zabbix_sender_sum`, error)
          return null;
      })     
}
async function get_data_google_sheet({sheet_id, keys, names, sheet_index, is_multiple}) {
    
    return await fetch(`https://4ac6qsel8e.execute-api.ap-southeast-1.amazonaws.com/dev/get_data_google_sheet`, {
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sheet_id, keys, names, is_multiple, sheet_index}),
        method: 'POST',
      })
        .then(res => res.json())
        .catch(error => {
          // logger.info(`api_zabbix_sender_sum`, error)
          return null;
      })     
}


async function list_folder(bucket_name,prefix, delimiter='/'){
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey
  });
  return new Promise((resolve, reject) => {
      s3.listObjects({
        Bucket: bucket_name,
        Delimiter: '/',
        Prefix:prefix,
        MaxKeys:10000
      },function (err, data) {
        if (err) resolve([]); // an error occurred
        else{
          // console.log('list_folder', bucket_name, JSON.stringify(data))
          resolve(data); 
        }
      });
    });
};

async function create_folder(bucket_name,folder_name){
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey
  });
  return new Promise((resolve, reject) => {
      s3.putObject({
        Bucket: bucket_name,
        Key: folder_name,
      },function (err, data) {
        if (err) resolve([]); // an error occurred
        else{
          console.log('upload_data', bucket_name, JSON.stringify(data))
          resolve(data); 
        }
      });
    });
};

async function upload_data(bucket_name,file_name, data){
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey
  });
  return new Promise((resolve, reject) => {
      s3.upload({
        Bucket: bucket_name,
        Key: file_name,
        Body: data,
        // ACL: 'public-read'
      },function (err, data) {
        if (err) resolve([]); // an error occurred
        else{
          console.log('upload_data', bucket_name, JSON.stringify(data))
          resolve(data.Location); 
        }
        
      });
    });
};

async function get_object_from_s3(bucket_name,file_name){
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey
  });
  return new Promise((resolve, reject) => {
      s3.getObject({
        Bucket: bucket_name,
        Key: file_name,        
        // ACL: 'public-read'
      },function (err, data) {
        if (err) resolve(null); // an error occurred
        else{
          resolve(data.Body); 
        }
        
      });
    });
};



async function request_info({hostname, port, path, method, body, headers = {'Content-Type': 'application/json'}}){
  console.log(`request_info`, JSON.stringify({hostname, port, path, method, body}));
  return await new Promise(function(resolve, reject) {
      var options = {
            hostname,
            port,
            path,
            method,
            headers
          };
          var req = https.request(options, (res) => {
            // console.log('statusCode:', res.statusCode);
            // console.log('headers:', res.headers);
            res.on('data', (d) => {
                console.log('request_info data ', d.toString())
                resolve(JSON.parse(d.toString()));
            });
          });

          req.on('error', (e) => {
            console.error(e);
            resolve(null);
          });
          if(method ==='POST') req.write(JSON.stringify(body));
          req.end();
    });
}

function sortObject(o) {
    var sorted = {},
        key, a = [];

    for (key in o) {
        if (o.hasOwnProperty(key)) {
            a.push(key);
        }
    }

    a.sort();

    for (key = 0; key < a.length; key++) {
        sorted[a[key]] = o[a[key]];
    }
    return sorted;
}


function sortObjectGetListValue(o) {
    delete o.cert;
    var sorted = {},
        key, a = [];

    for (key in o) {
        if (o.hasOwnProperty(key)) {
            a.push(key);
        }
    }

    a.sort();
    // logger.info('sort list key', a.join(':'));
    let l = [];
    for (key = 0; key < a.length; key++) {
        l.push(o[a[key]]);
    }
    return l;
}
async function getNextIdByKey({key_name='vnpayid'}){
    let token = process.env.TOKEN_UPSTASH ||  `AXiNASQgMTg3Yjk0MjEtOTg5Mi00YWE1LTg5M2ItNGExYmZlZGUxMjAyZjljZDRmNTIxMDlkNGNiNjllMmY3NmUzYjQ1M2VjNDg=`;
    let requestId = await request_info({
                        hostname:'apn1-touching-robin-30861.upstash.io', 
                        port:443, 
                        path:`/incr/${key_name}`, 
                        method:'GET', 
                        headers: {'Content-Type': 'application/json','Authorization': `Bearer ${token}`}});
    let vnp_TxnRef = null;
    if(requestId){
        console.log('requestId', JSON.stringify(requestId))
        return requestId.result;
    }else{
        return null
    }

}

async function cloud_redis_exec({args}){
    const _path = args.join('/');
    let token = process.env.TOKEN_UPSTASH ||  `AXiNASQgMTg3Yjk0MjEtOTg5Mi00YWE1LTg5M2ItNGExYmZlZGUxMjAyZjljZDRmNTIxMDlkNGNiNjllMmY3NmUzYjQ1M2VjNDg=`;
    let result = await request_info({
                        hostname:'apn1-touching-robin-30861.upstash.io', 
                        port:443, 
                        path:_path, 
                        method:'GET', 
                        headers: {'Content-Type': 'application/json','Authorization': `Bearer ${token}`}});
    return result;

}


function htmlDemo(){
  return {
                statusCode:200,
                "body": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport"

        content="user-scalable=no,initial-scale=1,maximum-scale=1,minimum-scale=1,width=device-width,height=device-height">
  <meta name="theme-color" content="#152944">
  <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>

  <title>VBEE Payment Gateway</title>
     

      <style>
      .loading-wrap-index {
              display: flex;
              flex-flow: column wrap;
              justify-content: center;
              align-items: center;
              margin: 100px 0;
              /* loading gif wrap */
            }
            .loading-wrap-index .loading-gif-wrap {
              width: 145px;
              height: 145px;
              background-color: #7a8593;
              display: flex;
              flex-flow: column nowrap;
              justify-content: center;
              align-items: center;
              border-radius: 4px;
            }
            .loading-wrap-index .loading-gif-wrap .loading-gif {
              margin-top: 20px;
              width: 40px;
              image-rendering: initial;
            }
            .loading-wrap-index .loading-message {
              margin-top: 20px;
              text-align: center;
              font-size: 13px;
            }
            .button {
              background-color: #4CAF50; /* Green */
              border: none;
              color: white;
              padding: 15px 32px;
              text-align: center;
              text-decoration: none;
              display: inline-block;
              font-size: 16px;
            }
      </style>
</head>
<body>
<div id="root" class="notranslate">
   
  <div class="loading-wrap-index">
    <div class="loading-gif-wrap">
      <img id="image_qr_code" src="https://surfacecu.com.vn/wp-content/uploads/2020/05/surface-laptop-3-a1-1.jpg" alt="logo zalopay" class="logo-zalopay" style="
    width: 150px;
">
    </div>
    <div class="loading-message">
      <p>Laptop Asus VivoBook</p>
      <p>Giá Tiền: 50.000 VND</p>
      <button class="button" style="width: 300px;" id="mua_1_san_pham">Thanh Toán qua ZaloPay</button><br/><br/>
      <button class="button" style="width: 300px;" id="mua_2_san_pham">Ví MoMo</button><br/><br/>
      <button class="button" style="width: 300px;" id="mua_3_san_pham">Thanh Toán qua VnPay</button><br/><br/>
      <button class="button" style="width: 300px;" id="mua_4_san_pham">Thanh Toán qua Paypal</button><br/><br/>
      <button class="button" style="width: 300px;" id="mua_5_san_pham">Chuyển khoản qua bank</button><br/><br/>
      <button class="button" style="width: 300px;" id="mua_6_san_pham">Thanh toán qua ShopeePay</button><br/><br/>
    </div>

  </div>
 
</div>
</body>
<script type="text/javascript">
$(document).ready(function(){
  var $idInterval = null;
  $.ajaxSetup({
    headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization':'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJTZnl6amZMR0NoMEx5dF9IZU52cTNuWHhjbXBzQkZZMU80NFVpazFDVlV3In0.eyJleHAiOjE2NDk5OTIzNjUsImlhdCI6MTY0NzQwMDM2NSwianRpIjoiMTBjYmExYWUtZDNhZi00YzNkLTg1YjMtZTI2ZmZhNTdjZTJiIiwiaXNzIjoiaHR0cHM6Ly9kZXYtYWNjb3VudHMudmJlZS52bi9hdXRoL3JlYWxtcy92YmVlLWhvbGRpbmciLCJhdWQiOlsicGF5bWVudC1odWIiLCJ2YmVlLXR0cy1hY2NvdW50IiwiYWNjb3VudCJdLCJzdWIiOiI2YmNkYTcxYi0zNzdmLTQ2OWUtYWJlNi1lZGM3MjBlZDllNmYiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJ2YmVlLXR0cy1wYXltZW50IiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyJodHRwczovL2Rldi52YmVlLnZuIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzLXZiZWUtaG9sZGluZyIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJwYXltZW50LWh1YiI6eyJyb2xlcyI6WyJyZWNvbmNpbGUiLCJ2aWV3LW9yZGVyIiwiY3JlYXRlLXBheW1lbnQiXX0sInZiZWUtdHRzLWFjY291bnQiOnsicm9sZXMiOlsidmlldy11c2VycyJdfSwiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJlbWFpbCBwcm9maWxlIiwiY2xpZW50SG9zdCI6IjE0LjE2MC43MC40MiIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiY2xpZW50SWQiOiJ2YmVlLXR0cy1wYXltZW50IiwicHJlZmVycmVkX3VzZXJuYW1lIjoic2VydmljZS1hY2NvdW50LXZiZWUtdHRzLXBheW1lbnQiLCJjbGllbnRBZGRyZXNzIjoiMTQuMTYwLjcwLjQyIn0.X00-z5HgS2SIpIXG_nU4dTCsV2_J-Sv8YLn1wq7owLk-YrKqh9D6o85mOiBOe-zc6xRn8TBeYL8CE0WbZsGO3Y1qGk50lxYDDXLiR9P_WaqszKEF6X4k1c57PQnZv8-m_y6TYvggrkegETm-_5HYpt5WuJPGQM6WUbCf8RItn57emh1-I-c8BUixSQNtgzPdSOrJ-jzecKCzIFmEWNxW2r301ChUviE1mRpX3fiOF22Iua0Yp8d8eRyCdk_dfFKnuu8ycYJAURkpAufq-kSM5Z4YTz0O1Y81jPixqZeMdks_BgMx5i_a7d7KauOtp1G5dBnaHn3wX9eS30GWyQOVcw'
        }
    });

    $("#mua_1_san_pham").click(function(){
        $("#mua_1_san_pham").css('background-color','gray');

        $("#mua_1_san_pham").html('<img src="https://sbgateway.zalopay.vn/build/image/loading.gif" style="width: 70px;" alt="loading" class="loading-gif">');

          $.post("https://payment-sb.vbeecore.com/api/create/vbee",
          JSON.stringify({"money":10000,
        "type":"zalopay","bank_code":"NCB", 
        "ipn_url":"https://payment-sb.vbeecore.com/api/provider/demo", 
        "callback_url":"https://payment-sb.vbeecore.com/api/provider/demo",
        "cert":"e44600c783de79bd1becb04cca92e02d0d3545f98df4a465d45cd66939622f73",
         "desc":"Gói trả trước", "customer_id":"12"}),
          function(jdata, status){
            
            console.log('create response', JSON.stringify(jdata));
            if(jdata.error == 1){
                alert(jdata.error_msg);
            }else{
                window.location.href = jdata.link;  
            }
            
          });
    });
    $("#mua_2_san_pham").click(function(){
        $("#mua_2_san_pham").css('background-color','gray');
        $("#mua_2_san_pham").html('<img src="https://sbgateway.zalopay.vn/build/image/loading.gif" style="width: 70px;"  alt="loading" class="loading-gif">');
          $.post("https://payment-sb.vbeecore.com/api/create/vbee",
          JSON.stringify({"money":10000,
        "type":"momopay","bank_code":"NCB", 
        "ipn_url":"https://payment-sb.vbeecore.com/api/provider/demo", 
        "callback_url":"https://payment-sb.vbeecore.com/api/provider/demo",
        "cert":"0606d2a710cb91a8f8f9776403a63651c254534225ee9dad5fa551b037c3a1e0",
         "desc":"Gói trả trước", "customer_id":"12"}),
          function(jdata, status){
            console.log('create response', JSON.stringify(jdata));
            if(jdata.error == 1){
                alert(jdata.error_msg);
            }else{
                window.location.href = jdata.link;  
            }
            
          });
    });
    $("#mua_3_san_pham").click(function(){
        $("#mua_3_san_pham").css('background-color','gray');
        $("#mua_3_san_pham").html('<img src="https://sbgateway.zalopay.vn/build/image/loading.gif" style="width: 70px;"  alt="loading" class="loading-gif">');
          $.post("https://payment-sb.vbeecore.com/api/create/vbee",
          JSON.stringify({"money":10000,
        "type":"atm","bank_code":"NCB", 
        "ipn_url":"https://payment-sb.vbeecore.com/api/provider/demo", 
        "callback_url":"https://payment-sb.vbeecore.com/api/provider/demo",
        "cert":"cd16816a9b4f83507b79aff9f0caaa1e78b6a3ea708af3cad739e673c651a72f",
         "desc":"Gói trả trước", "customer_id":"12"}),
          function(jdata, status){
            console.log('create response', JSON.stringify(jdata));
            if(jdata.error == 1){
                alert(jdata.error_msg);
            }else{
                window.location.href = jdata.link;  
            }
          });
    });
     $("#mua_4_san_pham").click(function(){
        $("#mua_4_san_pham").css('background-color','gray');
        $("#mua_4_san_pham").html('<img src="https://sbgateway.zalopay.vn/build/image/loading.gif" style="width: 70px;"  alt="loading" class="loading-gif">');
          $.post("https://payment-sb.vbeecore.com/api/create/vbee",
          JSON.stringify({"money":10000,
        "type":"paypal","bank_code":"NCB", 
        "ipn_url":"https://payment-sb.vbeecore.com/api/provider/demo", 
        "callback_url":"https://payment-sb.vbeecore.com/api/provider/demo",
        "cert":"5d98553cf8d79d65f236715b0d18129c0ce8914e21aa384b546e602f1303f850",
         "desc":"Gói trả trước", "customer_id":"12"}),
          function(jdata, status){
            console.log('create response', JSON.stringify(jdata));
            if(jdata.error == 1){
                alert(jdata.error_msg);
            }else{
                window.location.href = jdata.link;  
            }
          });
    });

    $("#mua_5_san_pham").click(function(){
        $("#mua_5_san_pham").css('background-color','gray');
        $("#mua_5_san_pham").html('<img src="https://sbgateway.zalopay.vn/build/image/loading.gif" style="width: 70px;"  alt="loading" class="loading-gif">');
          $.post("https://payment-sb.vbeecore.com/api/create/vbee",
          JSON.stringify({"money":10000,
        "type":"bank","bank_code":"22010002891416", 
        "ipn_url":"https://payment-sb.vbeecore.com/api/provider/demo", 
        "callback_url":"https://payment-sb.vbeecore.com/api/provider/demo",
        "cert":"8a9f9a4d798bccf3bb3871b35716a60dcdffd3105a6d311ea2bf89fb1a595aa8",
         "desc":"Gói trả trước", "customer_id":"12"}),
          function(jdata, status){
            console.log('create response', JSON.stringify(jdata));
            if(jdata.error == 1){
                alert(jdata.error_msg);
            }else{
                alert('Bạn vui lòng chuyển khoản đến tài khoản ' + jdata.bank_info.bank_name + ', Số tài khoản ' + jdata.bank_info.bank_number + ', Nội dung: ' + jdata.bank_info.code );
            }
            $("#mua_5_san_pham").css('background-color','#4CAF50');
            $("#mua_5_san_pham").html('Chuyển khoản qua bank');
            
            

          });
    });
    $("#mua_6_san_pham").click(function(){
        $("#mua_6_san_pham").css('background-color','gray');
        $("#mua_6_san_pham").html('<img src="https://sbgateway.zalopay.vn/build/image/loading.gif" style="width: 70px;"  alt="loading" class="loading-gif">');
          $.post("https://payment-sb.vbeecore.com/api/create/vbee",
          JSON.stringify({"money":499000,"type":"shopeepay",
              "callback_url":"https://api-beta.vface.ai/api/public/payment/redirect/2020","desc":"VFACE7",
              "customer_id":872,"bank_code":"techcombank","ipn_url":"https://api-beta.vface.ai/api/public/payment/ipn/2020",
              "provider_order_id":2020,"cert":"03b0d35c8b647a5a18a76ee1672dd08a65eff827abadb391ff342e72e8eec68b"}),
          function(jdata, status){
            console.log('create response', JSON.stringify(jdata));
            if(jdata.error == 1){
                alert(jdata.error_msg);
            }else{
              alert("Bạn vui lòng scan qr code để thanh toán");
             console.log('open', jdata.link);
              window.open( jdata.link,'popUpWindow','height=500,width=400,left=100,top=100,resizable=yes,scrollbars=yes,toolbar=yes,menubar=no,location=no,directories=no, status=yes');

            }
            //check state thanh toán
            $idInterval = setInterval(()=>{
                console.log('check status');
                 $.get("https://payment-sb.vbeecore.com/api/provider/detail/"+jdata.token, function(data, status){
                    console.log(data);
                    if(data.state != 0){
                          if(data.state == 1){
                              alert("Thanh Toán Thành Công");
                          }else{
                              alert("Thanh Toán không thành công");
                          }
                          clearInterval($idInterval);
                          $("#mua_6_san_pham").css('background-color','#4CAF50');
                          $("#mua_6_san_pham").html('Thanh toán qua ShopeePay');  
                    }
                    
            
                  });
            }, 1000);
            
            

          });
    });

    

});

 

</script>
</html><html>`,
                "headers": {
                    'Content-Type': 'text/html',
            }
        }

}
function showHtmlReturn(msg){
  return {
                statusCode:200,
                "body": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport"

        content="user-scalable=no,initial-scale=1,maximum-scale=1,minimum-scale=1,width=device-width,height=device-height">
  <meta name="theme-color" content="#152944">
  <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>

  <title>VBEE Payment Gateway</title>
     

      <style>
      .loading-wrap-index {
              display: flex;
              flex-flow: column wrap;
              justify-content: center;
              align-items: center;
              margin: 100px 0;
              /* loading gif wrap */
            }
            .loading-wrap-index .loading-gif-wrap {
              width: 145px;
              height: 145px;
              background-color: #7a8593;
              display: flex;
              flex-flow: column nowrap;
              justify-content: center;
              align-items: center;
              border-radius: 4px;
            }
            .loading-wrap-index .loading-gif-wrap .loading-gif {
              margin-top: 20px;
              width: 40px;
              image-rendering: initial;
            }
            .loading-wrap-index .loading-message {
              margin-top: 20px;
              text-align: center;
              font-size: 13px;
            }
            .button {
              background-color: #4CAF50; /* Green */
              border: none;
              color: white;
              padding: 15px 32px;
              text-align: center;
              text-decoration: none;
              display: inline-block;
              font-size: 16px;
            }
      </style>
</head>
<body>
<div id="root" class="notranslate">
   
  <div class="loading-wrap-index">
    <div class="loading-gif-wrap">
      <img src="https://surfacecu.com.vn/wp-content/uploads/2020/05/surface-laptop-3-a1-1.jpg" alt="logo zalopay" class="logo-zalopay" style="
    width: 150px;
">
    </div>
    <div class="loading-message">
      <p>Laptop Asus VivoBook</p>
      <p>Giá Tiền: 50.000 VND</p>
      <button class="button" style="width: 250px;">${msg}</button><br/><br/>
        <a href="${PUBLIC_DOMAIN}/api/demo">Về trang sản phảm</a>
    </div>

  </div>
 
</div>
</body>

</html><html>`,
                "headers": {
                    'Content-Type': 'text/html',
            }
        }
}
function verified_request_hash256({private_key, params, cert}){
  console.log('verified_request_hash256 private_key', private_key, 'params', params.join('|'), cert, 'hash demo', CryptoJS.HmacSHA256(params.join('|'), private_key).toString());
  return cert === CryptoJS.HmacSHA256(params.join('|'), private_key).toString();
}
function request_hash256({private_key, params}){
  console.log('verified_request_hash256 private_key', private_key, 'params', params.join('|'), 'hash demo', CryptoJS.HmacSHA256(params.join('|'), private_key).toString());
  return CryptoJS.HmacSHA256(params.join('|'), private_key).toString();
}
async function get_config_channel({channel}){
  return config.get_channels(channel);
}

module.exports = {
    sortObjectGetListValue,
    sortObject,
    gen_access_token,
    request_hash256,
    verified_request_hash256,
    get_data_google_sheet,
    verified_token,
    google_sheet_report,
    cloud_redis_exec,
    list_bank_support,
    updateSheetByKey,
    htmlResponse,
    get_config_channel,
    syncDataGoogleSheet,
    htmlDemo,
    genTest,
    upload_data, 
    send_post_data,
    create_folder,
    showHtmlReturn,
    getNextIdByKey,
    list_folder,
    get_object_from_s3,
    request_info
};
