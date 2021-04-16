const AWS = require('aws-sdk');
const fs = require('fs');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const api = require('../config/api');

AWS.config.update({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
});
const templateName = 'TeamRequestDeclined';

const subjects = {
  TeamCallRequest: `CRMGROW Team member call join request: {{user_name}}`,
  TeamRequest: `CRMGROW Team member join request: {{user_name}}`,
  TeamRequestAccepted: `{{team_name}} has accepted your join request`,
  TeamRequestDeclined: `{{team_name}} has declined your join request`,
  TeamCallInvitation: `{{user_name}} has accepted your call request`,
  TeamCallInquiryFailed: `{{user_name}} has rejected your call request`,
  TeamCallAccepted: `{{leader_name}} has accepted your call request`,
  OnboardCall: `One on one onboarding`,
  WebinarInvitation: `Live "how to use" crmgrow webinar`,
  Welcome: 'Welcome to CRMGrow, {{user_name}}!',
  VideoWatched: 'CRMGrow video watched: {{contact_name}} at {{watched_at}}',
  PaymentNotification: 'CRMGrow payment notification',
};
const htmls = {};
fs.readFile(
  `./readTemplates/${templateName}.html`,
  'utf8',
  function (err, data) {
    if (err) {
      return console.log(err);
    }
    const createParams = {
      Template: {
        TemplateName: templateName,
        SubjectPart: subjects[templateName],
        TextPart: data,
        HtmlPart: data,
      },
    };

    const templatePromise = new AWS.SES({ apiVersion: '2010-12-01' })
      .updateTemplate(createParams)
      .promise();

    templatePromise
      .then((data) => {
        console.log('Created successfully', data);
      })
      .catch((err) => {
        console.log('Create is failed', err);
      });
  }
);
