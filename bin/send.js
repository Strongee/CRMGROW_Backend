const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const api = require('../config/api');
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const sendWelcomeEmail = async (data) => {
  const { id, email, user_name, password, time_zone } = data;
  const verification_url = `${urls.DOMAIN_URL}?id=${id}`;
  const templatedData = {
    user_name,
    verification_url,
    created_at: moment().tz(time_zone).format('MMMM D, YYYY, h:mmA'),
    webinar_url: system_settings.WEBINAR_LINK,
    import_url: urls.IMPORT_CSV_URL,
    template_url: urls.CONTACT_CSV_URL,
    facebook_url: urls.FACEBOOK_URL,
    login_url: urls.LOGIN_URL,
    terms_url: urls.TERMS_SERVICE_URL,
    privacy_url: urls.PRIVACY_URL,
    unsubscription_url: urls.UNSUSCRIPTION_URL,
    connect_url: urls.PROFILE_URL,
    user_email: email,
    recording_url: urls.INTRO_VIDEO_URL,
    recording_preview: urls.RECORDING_PREVIEW_URL,
    password,
  };

  const params = {
    Destination: {
      ToAddresses: [email],
    },
    Source: mail_contents.REPLY,
    Template: 'Welcome',
    TemplateData: JSON.stringify(templatedData),
  };

  // Create the promise and SES service object
  console.log('params', params);
  ses
    .sendTemplatedEmail(params)
    .promise()
    .then((res) => {
      console.log('res', res);
    })
    .catch((err) => {
      console.log('send email err', err);
    });
};

const data = {
  id: '5fd97ad994cf273d68a016da',
  email: 'gsteve@gmail.com',
  user_name: 'Super',
  password: 'password123',
  time_zone: 'America/Cancun',
};

sendWelcomeEmail(data);
