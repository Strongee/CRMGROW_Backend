const AWS = require('aws-sdk');
const fs = require('fs');
const { ENV_PATH } = require('../config/path');
const api = require('../config/api');

require('dotenv').config({ path: ENV_PATH });

AWS.config.update({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
});
const templateName = 'TeamRequest';
const subjects = {
  TeamRequest: `CRMGROW Team member call join request: {{user_name}}`,
};
const htmls = {};
fs.readFile(`./readTemplates/${templateName}.html`, 'utf8', function (
  err,
  data
) {
  if (err) {
    return console.log(err);
  }
  const updateParams = {
    Template: {
      TemplateName: templateName,
      SubjectPart: subjects[templateName],
      TextPart: subjects[templateName],
      HtmlPart: data,
    },
  };

  const templatePromise = new AWS.SES({ apiVersion: '2010-12-01' })
    .createTemplate(updateParams)
    .promise();

  templatePromise
    .then((data) => {
      console.log('Updated successfully', data);
    })
    .catch((err) => {
      console.log('Update is failed', err);
    });
});
