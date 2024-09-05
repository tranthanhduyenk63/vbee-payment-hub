/* eslint-disable */
const snakecaseKeys = require('snakecase-keys');
var dateFormat = require('dateformat');
const logger = require('../utils/logger');
const batchRequest = require('../utils/batchRequest');
const { BATCH_SIZE, TRANSACTION_STATE } = require('../constants');

//product
// let clientId = "AQjZANLi1ME8VyabUj_RLooE6GieIfUugG71TLkGDuw4VIgd69b7VuSgtkG2RyfjCkN0KbyzMF5Mv3dy";
// let clientSecret = "EM4rxhB3s81BgkVsUPmDw8LfAeVsLHqAxN0xCAhvaso6PDTLrNLc6rtayORWSdh0c6joSAGzxo7sLALX";
// //sandbox
// let clientId = "AS-fNFuJNVUee_td9qhDCx8B_8OoKOiYAmF9ow7wqqjiP_scYwCufRJWSjkYOGAmyE-_lqwRhNpYf1Q-";
// let clientSecret = "EOEnmq2tX4lzQpiPirPhAlf0ZSD37ToTSBC8eh2PWg9vi7by6kxjx963PURlMgasFDmvFcltF2ricYU6";
// 
/*
Email ID:
sb-fujzx6709622@personal.example.com
System Generated Password:
1O{P?I0r
*/

// paypal.configure({
//   // 'mode': 'live', //sandbox or live 
//   'mode': 'sandbox',
//   'client_id': clientId,
//   'client_secret': clientSecret
// });
function getConfig(config){

  return {
    "mode":config['paypal mode'],
    "client_id":config['paypal clientId'],
    "client_secret":config['paypal clientSecret'],
  }
} 
function getPaypal(config){
    let _paypal = require('paypal-rest-sdk');
    const snakeConfig = snakecaseKeys(config);
    _paypal.configure(snakeConfig);
    return _paypal;
}
// helper functions 
var createPay = ({payment,config }  ) => {

    return new Promise( ( resolve , reject ) => {
        getPaypal(config).payment.create( payment , function( err , payment ) {
         if ( err ) {
             reject(err); 
         }
        else {
            resolve(payment); 
        }
        }); 
    });
}
async function create_payment({config, money, bank_code, callback_url, desc, provider, token, request_id, redirect_domain}){
        var date = new Date();
        var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
        date = new Date(aestTime);
        logger.info('create_payment Ho_Chi_Minh time: '+date.toLocaleString(), { ctx: 'Paypal Create'})
        var vnp_CreateDate = dateFormat(date, 'yyyymmddHHMMss');
        var date_token = dateFormat(date, 'yyyy-mm-dd');
        let paymentReturnUrl  = `${redirect_domain}/api/paypal/redirect/${date_token}-${provider.name}-${request_id}`;
        var payment = {
        "intent": "sale",
        "payer": {
          "payment_method": "paypal"
        },
        "redirect_urls": {
          "return_url": paymentReturnUrl,
          "cancel_url": paymentReturnUrl
        },
        "transactions": [{
          "amount": {
            "total": parseFloat(`${money}`).toFixed(2),
            "currency": "USD"
          },
          "description": desc
        }]
    }

        let transaction = await createPay({config, payment} );
        logger.info(`Transaction DATE_ADD ${JSON.stringify(transaction)}`, { ctx: 'Paypal Create' });
        var id = transaction.id; 
        let paymentId = transaction.id;
        var links = transaction.links;
        var counter = links.length; 
        while( counter -- ) {
            if ( links[counter].method == 'REDIRECT') {
                // return res.redirect( links[counter].href )
                let link = links[counter].href;
                let pos = link.indexOf('token=');
                let token = "";
                if(pos){
                    pos += 'token='.length;
                    token = link.slice(pos);
                    // let result = await cloud_redis_exec({args:['set',`paypal_${token}`,`${date_token}-${provider}-${request_id}`]});
                    // console.log(token);
                    // let upload_to_s3 = await upload_data(bucket_name,`paypal_${token}`, JSON.stringify({token, 'token-id':`${date_token}-${provider}-${request_id}`}));
                    // console.log(`upload_to_s3`, JSON.stringify(upload_to_s3));

                }
                return {error: 0, id, link: links[counter].href, transaction_id: id};
            }
        }
        return {
            error:1
        }
}
var orderPay = ( paymentId, payerId, money, config ) => {
    return new Promise( ( resolve , reject ) => {
        const execute_payment_json = {
        "payer_id": payerId,
        "transactions": [{
          "amount": {
            "currency": "USD",
            "total": parseFloat(`${money}`).toFixed(2)
          }
        }]
        }
        console.log('config', JSON.stringify(config))
        getPaypal(config).payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
          reject(error); 
        } else {
          resolve(payment); 
        }
        });
    });
}
async function verified_data({config, query, transaction}){    
    let {PayerID, paymentId, token}  = query;
    
    if(!PayerID && !paymentId){
        return {
            error: 1,
            error_msg: `Thanh toán không thành công`
        }
    }
    let info = await orderPay(paymentId, PayerID, transaction.money, config);

    logger.info(`verified_data ${JSON.stringify(info)}`, { ctx: 'Paypal verify data'});
    if(!info){
    return {
            error: -1
        }
    }
    if(info.state == 'approved'){
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
async function getTransactionStatus({config, transactionId}) {
    return new Promise( ( resolve , reject ) => {
      getPaypal(config).payment.get(transactionId, function (error, payment) {
          if (error) {
            resolve({ state: 'error', transactionId });
          } else {
            resolve({...payment, transactionId});
          }
        });
    });
}

async function getTransactionsStatus({ config, transactions }) {
  const params = transactions.map((transaction) => {
    const obj = {
      config, 
      transactionId: transaction.transactionId,
    };
    return obj;
  })
  const infos = await batchRequest(getTransactionStatus, params, BATCH_SIZE);
  const res = infos.map((info) => {
    const { transactionId, state } = info;
    let recheckState, recheckMoney, isRecheckFinal;

    if  (state === 'approved') {
      recheckState = TRANSACTION_STATE.SUCCESS,
      recheckMoney = Number(info.transactions[0].amount.total);
      isRecheckFinal = true;
    } else {
      recheckState = TRANSACTION_STATE.FAILED;
      recheckMoney = 0;
      isRecheckFinal = false;
    }
    return {
      transactionId,
      recheckState,
      recheckMoney,
      isRecheckFinal,
    }
  })
  return res;
};

module.exports = {
   create_payment,
   verified_data,
   getConfig,
   getTransactionStatus,
   getTransactionsStatus,
};

// (async function () {
// let money = 10, bank_code='', callback_url='', desc='Aiclip', provider='vbee', token='', request_id='';
// console.log(await create_payment({money, bank_code, callback_url, desc, provider, token, request_id}))

    
// })().then(() => {
//     process.exit();
// });   

