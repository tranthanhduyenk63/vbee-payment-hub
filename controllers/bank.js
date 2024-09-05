const bankService = require('../services/bank');
const logger = require('../utils/logger');

const getTransferBank = async (payload, context) => {
  const { providerName } = payload;
  logger.info(`create verified: ${providerName}`);

  const banks = await bankService.getTransferBank([providerName]);
  let results = []  
  for(let item of banks){
      try{
        item["bank_address"] = item.bankAddress;
        item["bank_holder"] = item.bankHolder;
        item["bank_image"] = item.bankImage;
        item["bank_name"] = item.bankName;
        item["bank_number"] = item.bankNumber;
      }catch (error) {
        console.error(error);
      }
      results.push(item);
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ error: 0, list: results }),
  };
};

module.exports = {
  getTransferBank,
};
