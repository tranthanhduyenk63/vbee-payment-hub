const { forwardRevenueReportsToICS } = require('../services/ics');
const revenueReportService = require('../services/revenueReport');
const { validateRevenueReport } = require('../validation/revenueReport');

const createRevenueReports = async (payload, context, callback) => {
  validateRevenueReport(payload.body);

  const { clientId } = payload;
  const { type, time, channel, provider, userReport, revenueReports } =
    JSON.parse(payload.body);

  await revenueReportService.createRevenueReports({
    clientId,
    type,
    time,
    channel,
    provider,
    userReport,
    revenueReports,
  });

  await forwardRevenueReportsToICS(JSON.parse(payload.body));

  return { statusCode: 200, body: JSON.stringify({ error: 0 }) };
};

module.exports = { createRevenueReports };
