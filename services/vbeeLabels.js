const { REVENUE_SME_PROVIDERS } = require('../configs');
const { VBEE_PRODUCT, VBEE_SUB_PRODUCTS, PAY_TYPE } = require('../constants');

const convertToProduct = (providerName, payType, feeType) => {
  const { AI_VOICE, SMART_IVR, CALLBOT } = VBEE_PRODUCT;
  const {
    AI_VOICE_SUB,
    AI_VOICE_SME_PAYG,
    AI_VOICE_MOBIFONE_PAYG,
    SMART_IVR_SUB,
    SMART_IVR_FE_PAYG,
    SMART_IVR_MOMO_PAYG,
    SMART_IVR_MOBIFONE_PAYG,
    SMART_IVR_SME_PAYG,
    SMART_IVR_SACOMBANK_PAYG,
    CALLBOT_FE_PAYG,
    CALLBOT_SME_PAYG,
    CALLBOT_SACOMBANK_PAYG,
  } = VBEE_SUB_PRODUCTS;

  if (!payType && !feeType) {
    switch (providerName) {
      case 'vbee-studio':
        return AI_VOICE;
      case 'aicc-cloud':
        return SMART_IVR;
      default:
        return providerName;
    }
  }
  if (payType === PAY_TYPE.SUB) {
    switch (providerName) {
      case 'vbee-studio':
        return AI_VOICE_SUB;
      case 'aicc-cloud':
      case 'smart-ivr':
        return SMART_IVR_SUB;
      default:
        return providerName;
    }
  }
  if (payType === PAY_TYPE.PAYG) {
    switch (feeType) {
      case AI_VOICE: {
        if (providerName === 'vbee-studio') return AI_VOICE_SME_PAYG;
        if (providerName === 'vbee-mobifone') return AI_VOICE_MOBIFONE_PAYG;
        break;
      }
      case SMART_IVR: {
        if (providerName === 'aicc-fe') return SMART_IVR_FE_PAYG;
        if (providerName === 'aicc-momo') return SMART_IVR_MOMO_PAYG;
        if (providerName === 'aicc-mobifone') return SMART_IVR_MOBIFONE_PAYG;
        if (providerName === 'Smart-IVR-Sub-v2') return SMART_IVR_SUB;
        if (providerName === 'aicc-sacombank') return SMART_IVR_SACOMBANK_PAYG;
        if (REVENUE_SME_PROVIDERS.includes(providerName)) {
          return SMART_IVR_SME_PAYG;
        }
        break;
      }
      case CALLBOT: {
        if (providerName === 'aicc-fe') return CALLBOT_FE_PAYG;
        if (providerName === 'aicc-momo') return CALLBOT_SME_PAYG;
        if (providerName === 'aicc-sacombank') return CALLBOT_SACOMBANK_PAYG;
        if (REVENUE_SME_PROVIDERS.includes(providerName)) {
          return CALLBOT_SME_PAYG;
        }
        break;
      }
      default:
        return providerName;
    }
  }
  return providerName;
};

module.exports = { convertToProduct };
