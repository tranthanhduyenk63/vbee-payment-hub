const { ICS_URL } = require('../configs');
const { REPORT_TYPE } = require('../constants');
const callApi = require('../utils/callApi');
const { getAccessToken } = require('./iam');

const AICC_V2_PROVIDERS = [
  'aicc-cloud',
  'aicc-sacombank',
  'aicc-fe',
  'aicc-mobifone',
  'aicc-momo',
  'Smart-IVR-Sub-v2',
];

const forwardRevenueReportsToICS = async ({
  type,
  time,
  channel,
  provider,
  revenueReports,
}) => {
  const isForward =
    type === REPORT_TYPE.DAY &&
    channel === 'aicc' &&
    AICC_V2_PROVIDERS.includes(provider);

  if (!isForward) return;

  try {
    const accessToken = await getAccessToken();

    const response = await callApi({
      method: 'POST',
      url: `${ICS_URL}/api/v1/revenue-reports`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: { time, provider, revenueReports },
    });

    console.log('Response from ICS', response);
  } catch (error) {
    console.log('Error when forward to ICS', error);
  }
};

module.exports = { forwardRevenueReportsToICS };
