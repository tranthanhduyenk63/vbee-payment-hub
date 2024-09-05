/* eslint-disable */
var dateFormat = require('dateformat');

let {
    getNextIdByKey,
} = require('./utils');

const Bank = require('../model/bank');
const Channel = require('../model/channel');

const transactionService = require('../services/transaction');
const CustomError = require('../errors/CustomError');
const { PARTNER_NAME } = require('../constants');

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

async function create_payment({config, money, bank_code, callback_url, desc, provider, token, request_id}){
    var date = new Date();
    var aestTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
    date = new Date(aestTime);
    logger.info('create_payment Ho_Chi_Minh time: ' + date.toLocaleString(), {ctx: 'Bank Create'})
    var vnp_CreateDate = dateFormat(date, 'yyyymmddHHMMss');
    var date_token = dateFormat(date, 'yyyy-mm-dd');
    if(!config.bankPrefix){
        return {
            error:1,
            error_msg: `Chưa config bank prefix`
        }
    }
    const bank = await Bank.findOne({ bankNumber: bank_code, provider: provider._id });
    if (!bank)
        return {
            error: 1,
            error_msg: 'Không tìm thấy bank',
        };

    let id_transaction = await getNextIdByKey({});
    console.log('id_transaction: ', id_transaction);

    if(!id_transaction){
        return {
            error:1,
            error_msg: `Khởi tạo id giao dịch bị lỗi`
        }
    }
    let item = bank.toJSON();
    try{
        item["bank_address"] = item.bankAddress;
        item["bank_holder"] = item.bankHolder;
        item["bank_image"] = item.bankImage;
        item["bank_name"] = item.bankName;
        item["bank_number"] = item.bankNumber;
      }catch (error) {
        console.error(error);
      }
  
    const bank_code_gen = `${config.bankPrefix}${id_transaction}`;
    return {
        error: 0,
        bank_info: { ...item, code: bank_code_gen},
    }
}

async function verified_data({ config, query }){    
    //query = {"query":{"sender":"techcombank","message":{"text":"TK 19033255559016\nSo tien GD:+2,490,000\nSo du:41,071,164\nAB872"}},"app":{"version":"1"},"_version":1}
    query = query.query;
    logger.info(`verified_data ${JSON.stringify(query)}`, { ctx: 'Bank' })
    let {sender, message } = query;
    let {text } = message;
    let {
        error,
        error_msg,
        money,
        desc
    } = export_info_sms(query);
    if(error === 1)
        throw new CustomError(-1, PARTNER_NAME.BANK, 'Không export được thông tin từ tin nhắn');

    console.log(`verified_data`, text)
    const allChannels = await Channel.find({}).lean();
    if (!allChannels?.length)
        throw new CustomError(-1, PARTNER_NAME.BANK, 'Không tìm thấy channels');

    let channel_info = null;
    for (const channel of allChannels) {
        const { bankPrefix } = channel; 
        if (!bankPrefix) continue;
        if (text.toLowerCase().indexOf(bankPrefix.toLowerCase()) !== -1) {
            channel_info = channel;
            break;
        }
    }

    if (!channel_info)
        throw new CustomError(-1, PARTNER_NAME.BANK, 'Không tìm thấy mã nhà phân phối tương ứng');
    
    const { bankPrefix } = channel_info;
    const regexp = new RegExp(`${bankPrefix}[0-9]+`, 'gi');
    if(!text.match(regexp))
        throw new CustomError(-1, PARTNER_NAME.BANK, 'Không tìm thấy giao dịch');
    
    let m = text.match(regexp);
    if(m.length < 0)
        throw new CustomError(-1, PARTNER_NAME.BANK, 'Không tìm thấy giao dịch');
    
    let bankPrefixRegexp = new RegExp(`\\b${bankPrefix}`, "gi");
    let bank_code = m[0].replace(bankPrefixRegexp, bankPrefix);


    const orderInfo = await transactionService.findTransaction({ 'bank.code': bank_code });
    if (!orderInfo)
        throw new CustomError(-1, PARTNER_NAME.BANK, `Không tìm thấy thông tin cho bank_code: ${bank_code}`);

    return {
        error:0,
        sms_money: money,
        info: orderInfo,
    }
}

function getConfig(config){

  return {
    "bank_prefix":config['bank_prefix']
  }
} 

module.exports = {
   create_payment,
   verified_data,
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
