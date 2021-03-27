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
const templateName = 'Welcome';

const subjects = {
  TeamCallRequest: `CRMGROW Team member call join request: {{user_name}}`,
  TeamRequest: `CRMGROW Team member join request: {{user_name}}`,
  TeamCallInvitation: `{{user_name}} has accepted your call request`,
  TeamCallInquiryFailed: `{{user_name}} has rejected your call request`,
  TeamCallAccepted: `{{leader_name}} has accepted your call request`,
  OnboardCall: `One on one onboarding`,
  WebinarInvitation: `Live "how to use" crmgrow webinar`,
  Welcome: 'Welcome to CRMGrow, {{user_name}}!',
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
        TextPart: subjects[templateName],
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
