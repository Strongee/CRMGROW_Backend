const access_key = 'AKIAQGFHZOADCLJVVX6F';
const secret_key = 'BCjJF7Q5sBJeFUj5heINuNlerPMgqZCSKjOteYI5A5NN';

var nodemailer = require('nodemailer');
var dotenv = require('dotenv').config();

var mailOptions = {
  from: 'example@email.com',
  to: 'other@email.com',
  text: 'This is some text',
  html: '<b>This is some HTML</b>',
};

// Send e-mail using SMTP
mailOptions.subject = 'Nodemailer SMTP transporter';

const smtpConnect = () => {
  var smtpTransporter = nodemailer.createTransport({
    port: 465,
    host: process.env.AWS_REGION,
    secure: true,
    auth: {
      user: process.env.AWS_ACCESS_KEY_ID,
      pass: process.env.AWS_SECRET_ACCESS_KEY,
    },
    debug: true,
  });

  smtpTransporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Message sent: ' + info.response);
    }
  });
};