const nodemailer = require('nodemailer');
const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASSWORD,
} = require('../../configs');

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER, // generated ethereal user
    pass: EMAIL_PASSWORD, // generated ethereal password
  },
});

const send = async ({ to, subject, text, htmlText, attachments }) => {
  try {
    await transporter.sendMail({
      from: EMAIL_USER,
      to,
      subject,
      text,
      html: htmlText, // html body
      attachments,
    });
  } catch (err) {
    console.log('err when send email', err);
  }
};

module.exports = {
  send,
};
