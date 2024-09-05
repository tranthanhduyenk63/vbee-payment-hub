const email = require('./email');
const callApi = require('../../utils/callApi');
const { NOTIFICATION_URL, SLACK_CALLBACK_URL } = require('../../configs');

const sendSlackNotification = async (messagePayload) => {
  try {
    const data = await callApi({
      method: 'POST',
      url: `${NOTIFICATION_URL}/api/v1/slack/send-message`,
      data: { ...messagePayload, callbackUrl: SLACK_CALLBACK_URL },
    });
    return data.result;
  } catch (error) {
    return {};
  }
};

module.exports = {
  email,
  sendSlackNotification,
};
