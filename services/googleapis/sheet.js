const google = require('@googleapis/sheets');
const { GOOGLE_CLIENT_EMAIL } = require('../../configs');
const logger = require('../../utils/logger');

const sheets = google.sheets('v4');

const getAccessToken = async () => {
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ];

  const auth = new google.auth.GoogleAuth({
    scopes,
    credentials: {
      client_email: GOOGLE_CLIENT_EMAIL,
      private_key: googlePrivateKey,
    },
  });
  const authClient = await auth.getClient();
  return authClient;
};

const readData = async (sheetId, sheetName, sheetRange) => {
  const authClient = await getAccessToken();
  const request = {
    spreadsheetId: sheetId,
    range: `${sheetName}!${sheetRange}`,
    auth: authClient,
  };

  try {
    const response = (await sheets.spreadsheets.values.get(request)).data;
    logger.info(response, { ctx: 'GoogleSheet' });
    return response?.values;
  } catch (err) {
    logger.error(err, { ctx: 'GoogleSheet' });
    return null;
  }
};

const updateRow = async (sheetId, sheetName, sheetRange, rowData) => {
  const authClient = await getAccessToken();
  const request = {
    spreadsheetId: sheetId,
    range: `${sheetName}!${sheetRange}`,
    valueInputOption: 'RAW',
    resource: {
      values: rowData,
    },
    auth: authClient,
  };

  try {
    const response = (await sheets.spreadsheets.values.update(request)).data;
    logger.info(response, { ctx: 'GoogleSheet' });
  } catch (err) {
    logger.error(err, { ctx: 'GoogleSheet' });
  }
};

const appendRow = async (sheetId, sheetName, sheetRange, rowData) => {
  const authClient = await getAccessToken();
  const request = {
    spreadsheetId: sheetId,
    range: `${sheetName}!${sheetRange}`,
    valueInputOption: 'RAW',
    resource: {
      values: rowData,
    },
    auth: authClient,
  };

  try {
    const response = (await sheets.spreadsheets.values.append(request)).data;
    logger.info(response, { ctx: 'GoogleSheet' });
  } catch (err) {
    logger.error(err, { ctx: 'GoogleSheet' });
  }
};

const updateCol = async (sheetId, sheetName, sheetRange, colData) => {
  const authClient = await getAccessToken();
  const request = {
    spreadsheetId: sheetId,
    range: `${sheetName}!${sheetRange}`,
    valueInputOption: 'USER_ENTERED',
    resource: { majorDimension: 'COLUMNS', values: [colData] },
    auth: authClient,
  };
  try {
    const response = (await sheets.spreadsheets.values.update(request)).data;
    logger.info(response, { ctx: 'GoogleSheet' });
  } catch (err) {
    logger.error(err, { ctx: 'GoogleSheet' });
  }
};

module.exports = {
  readData,
  updateRow,
  appendRow,
  updateCol,
};
