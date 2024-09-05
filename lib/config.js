/* eslint-disable */
let https = require('https')
const { v4: uuid } = require('uuid');
var AWS = require('aws-sdk');
var jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const bucket_name  = process.env.BUCKET_NAME;
const accessKeyId = process.env.S3_ID_LIB ;
const secretAccessKey= process.env.S3_KEY_LIB;
const GOOGLE_SHEET_CONFIG = process.env.GOOGLE_SHEET_CONFIG;
const FILE_STORE_CONFIG = process.env.FILE_STORE_CONFIG;
const PUBLIC_DOMAIN = process.env.PUBLIC_DOMAIN;
let fetch = require('node-fetch');

async function reload_load_config(){
  let {get_data_google_sheet, upload_data} = require("./utils");
   let config_channel = await get_data_google_sheet({
    sheet_id:GOOGLE_SHEET_CONFIG,
    "keys":{
    },
    "sheet_index":1,
    "is_multiple":1,
    "names":["redirect_domain","private_key", "bank_prefix", "name", "paypal mode", "zalopay base", "zalopay app_id",  "zalopay key 1",    "zalopay key 2",    "vnp_TmnCode",  "vnp_HashSecret",   "vnp_Url",  "paypal clientId",  "paypal clientSecret",  "momo partnerCode", "momo accessKey",   "momo serectkey", "momo hostname"]
  });
   console.log('config_channel', JSON.stringify(config_channel.result));
   let _map_channel  = {}
   for(let item of config_channel.result.results){
      _map_channel[item.name] = item;
   }
   console.log(JSON.stringify(_map_channel));

   //lấy thông tin banking
  let config_channel_banking = await get_data_google_sheet({
    sheet_id:GOOGLE_SHEET_CONFIG,
    "keys":{
    },
    "sheet_index":2,
    "is_multiple":1,
    "names":["provider", "bank_number", "bank_name", "bank_holder", "bank_address"]
  });
   console.log('config_channel_banking', JSON.stringify(config_channel_banking.result));
   let _map_banking  = {}
   for(let item of config_channel_banking.result.results){
    if(!Object.keys(_map_banking).includes(item.provider)) _map_banking[item.provider] = []
      _map_banking[item.provider].push(item);
   }
   console.log('_map_banking', JSON.stringify(_map_banking));

   let myConfig = {
    channel:_map_channel,
    banking: _map_banking
   }
   await upload_data(bucket_name, FILE_STORE_CONFIG, JSON.stringify(myConfig));
}

async function get_all_channels(){
    let {get_object_from_s3} = require("./utils");
    console.log('process.env', JSON.stringify(process.env), FILE_STORE_CONFIG)
    let data = (await get_object_from_s3(bucket_name, FILE_STORE_CONFIG)).toString('utf-8');
    // console.log(data);
    let jdata = JSON.parse(data);
    return jdata.channel;
}
async function get_channels(channel){
    let all_channels = await get_all_channels();
    return all_channels[channel]|| {};
}
async function get_banking(channel){
  let {get_object_from_s3} = require("./utils");
    let data = (await get_object_from_s3(bucket_name, FILE_STORE_CONFIG)).toString('utf-8');
    
    let jdata = JSON.parse(data);
    console.log(channel, jdata.banking);
    return jdata.banking[channel] ||[];
}


module.exports = {
  get_channels,
  get_all_channels,
  get_banking,
  reload_load_config
};
// (async function () {
//     // await reload_load_config();
//     console.log(await get_channels());
//     console.log(await get_banking());
// })().then(() => {
//     process.exit();
// });   