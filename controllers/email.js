const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const moment = require('moment');
const path = require('path');
const mime = require('mime-types');

const OAuth2 = google.auth.OAuth2;
const uuidv1 = require('uuid/v1');
var graph = require('@microsoft/microsoft-graph-client');
const sgMail = require('@sendgrid/mail');
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const webpush = require('web-push');
const phone = require('phone');
require('isomorphic-fetch');

const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const EmailTracker = require('../models/email_tracker');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const User = require('../models/user');
const Garbage = require('../models/garbage');

const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const system_settings = require('../config/system_settings');

const urls = require('../constants/urls');

const { TRAKER_PATH } = require('../config/path');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

const emailHelper = require('../helpers/email');

const bulkGmail = async (req, res) => {
  const { currentUser } = req;
  const { cc, bcc, to, subject, content, contacts, attachments } = req.body;
  const promise_array = [];
  const error = [];

  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  const token = JSON.parse(currentUser.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: token.refresh_token });
  await oauth2Client.getAccessToken().catch((err) => {
    console.log('get access err', err.message || err.msg);
    return res.status(406).send({
      status: false,
      error: 'not connected',
    });
  });

  if (typeof subject === 'undefined' || subject === '') {
    return res.status(400).send({
      status: false,
      error: 'Subject email must be specified',
    });
  }

  if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
    return res.status(400).json({
      status: false,
      error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
    });
  }

  let email_count = currentUser['email_info']['count'] || 0;
  const max_email_count =
    currentUser['email_info']['max_count'] ||
    system_settings.EMAIL_DAILY_LIMIT.BASIC;

  for (let i = 0; i < contacts.length; i++) {
    let email_subject = subject;
    let email_content = content;
    let promise;

    let _contact = await Contact.findOne({
      _id: contacts[i],
      tags: { $nin: ['unsubscribed'] },
    }).catch((err) => {
      console.log('contact found err', err.message);
    });

    if (!_contact) {
      _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
        console.log('contact found err', err.message);
      });
      promise = new Promise(async (resolve, reject) => {
        error.push({
          contact: {
            first_name: _contact.first_name,
            email: _contact.email,
          },
          err: 'contact email not found or unsubscribed',
        });
        resolve();
      });
      promise_array.push(promise);
      continue;
    }

    const email_info = currentUser['email_info'];
    if (email_info['is_limit'] && email_count > max_email_count) {
      promise = new Promise((resolve, reject) => {
        error.push({
          contact: {
            first_name: _contact.first_name,
            email: _contact.email,
          },
          err: 'email daily limit exceed!',
        });
        resolve();
      });
      promise_array.push(promise);
      continue;
    }

    email_subject = email_subject
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    email_content = email_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const email = new Email({
      ...req.body,
      content: email_content,
      subject: email_subject,
      contacts: contacts[i],
      user: currentUser.id,
      updated_at: new Date(),
      created_at: new Date(),
    });

    const _email = await email
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });

    const _activity = new Activity({
      content: 'sent email',
      contacts: contacts[i],
      user: currentUser.id,
      type: 'emails',
      emails: _email.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err.message);
      });

    let html_content;
    if (cc.length > 0 || bcc.length > 0) {
      html_content =
        '<html><head><title>Email</title></head><body><p>' +
        email_content +
        '</p><br/><br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';
    } else {
      html_content =
        '<html><head><title>Email</title></head><body><p>' +
        email_content +
        emailHelper.generateOpenTrackLink(activity.id) +
        '</p><br/><br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';
    }

    const attachment_array = [];
    if (attachments) {
      for (let i = 0; i < attachments.length; i++) {
        attachment_array.push({
          type: attachments[i].type,
          name: attachments[i].filename,
          data: attachments[i].content,
        });
      }
    }

    promise = new Promise(async (resolve, reject) => {
      try {
        const body = createBody({
          headers: {
            To: _contact.email,
            From: `${currentUser.user_name} <${currentUser.connected_email}>`,
            Subject: email_subject,
            Cc: cc,
            Bcc: bcc,
          },
          textHtml: html_content,
          textPlain: email_content,
          attachments: attachment_array,
        });
        request({
          method: 'POST',
          uri:
            'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
          headers: {
            Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
            'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
          },
          body,
        })
          .then(async () => {
            email_count += 1;
            Contact.update(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            )
              .then(() => {
                resolve();
              })
              .catch((err) => {
                console.log('contact updata err', err);
              });
          })
          .catch((err) => {
            console.log('gmail send err', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: err.message,
            });
            resolve();
          });
      } catch (err) {
        console.log('gmail send catch err', err.message);
        Activity.deleteOne({ _id: activity.id }).catch((err) => {
          console.log('err', err);
        });
        error.push({
          contact: {
            first_name: _contact.first_name,
            email: _contact.email,
          },
          err: err.messagae,
        });
        resolve();
      }
    }).catch((err) => {
      console.log('promise err', err);
    });
    promise_array.push(promise);
  }

  Promise.all(promise_array)
    .then(() => {
      if (error.length > 0) {
        return res.status(405).json({
          status: false,
          error,
        });
      }
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

const listGmail = async (req, res) => {
  const { currentUser } = req;
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  const token = JSON.parse(currentUser.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: token.refresh_token });
  const gmail = google.gmail({ auth: oauth2Client, version: 'v1' });
  gmail.users.messages.list(
    {
      includeSpamTrash: false,
      userId: currentUser.email,
    },
    function (err, response) {
      console.log(err);
      const data = response.data;
      return res.send({
        data,
      });
    }
  );
};

const getGmail = async (req, res) => {
  const { currentUser } = req;
  const oauth2Client = new google.auth.OAuth2(
    api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  const token = JSON.parse(currentUser.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: token.refresh_token });

  const gmail = google.gmail({ auth: oauth2Client, version: 'v1' });
  gmail.users.messages.get(
    {
      userId: currentUser.email,
      id: req.params.id,
    },
    function (err, response) {
      console.log(err);
      const data = response.data;
      return res.send({
        data,
      });
    }
  );
};

const bulkOutlook = async (req, res) => {
  const { currentUser } = req;
  const { cc, bcc, to, subject, content, contacts, attachments } = req.body;
  const promise_array = [];
  const error = [];

  const token = oauth2.accessToken.create({
    refresh_token: currentUser.outlook_refresh_token,
    expires_in: 0,
  });
  let accessToken;

  if (contacts.length > system_settings.EMAIL_DAILY_LIMIT.BASIC) {
    return res.status(400).json({
      status: false,
      error: `You can send max ${system_settings.EMAIL_DAILY_LIMIT.BASIC} contacts at a time`,
    });
  }

  let email_count = currentUser['email_info']['count'] || 0;
  const max_email_count =
    currentUser['email_info']['max_count'] ||
    system_settings.EMAIL_DAILY_LIMIT.BASIC;

  for (let i = 0; i < contacts.length; i++) {
    await new Promise((resolve, reject) => {
      token.refresh(function (error, result) {
        if (error) {
          reject(error.message);
        } else {
          resolve(result.token);
        }
      });
    })
      .then((token) => {
        accessToken = token.access_token;
      })
      .catch((error) => {
        console.log('outlook token grant error', error);
        return res.status(406).send({
          status: false,
          error: 'not connected',
        });
      });
    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
    let email_content = content;
    let email_subject = subject;
    let promise;

    let _contact = await Contact.findOne({
      _id: contacts[i],
      tags: { $nin: ['unsubscribed'] },
    }).catch((err) => {
      console.log('contact found err', err.message);
    });

    if (!_contact) {
      _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
        console.log('contact found err', err.message);
      });
      promise = new Promise(async (resolve, reject) => {
        error.push({
          contact: {
            first_name: _contact.first_name,
            email: _contact.email,
          },
          err: 'contact email not found or unsubscribed',
        });
        resolve();
      });
      promise_array.push(promise);
      continue;
    }

    const email_info = currentUser['email_info'];
    if (email_info['is_limit'] && email_count > max_email_count) {
      promise = new Promise((resolve, reject) => {
        error.push({
          contact: {
            first_name: _contact.first_name,
            email: _contact.email,
          },
          err: 'email daily limit exceed!',
        });
        resolve();
      });
      promise_array.push(promise);
      continue;
    }

    email_subject = email_subject
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    email_content = email_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const email = new Email({
      ...req.body,
      content: email_content,
      subject: email_subject,
      contacts: contacts[i],
      user: currentUser.id,
      updated_at: new Date(),
      created_at: new Date(),
    });

    const _email = await email
      .save()
      .then()
      .catch((err) => {
        console.log('err', err.message);
      });

    const _activity = new Activity({
      content: 'sent email',
      contacts: contacts[i],
      user: currentUser.id,
      type: 'emails',
      emails: _email.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const activity = await _activity.save().then();

    const cc_array = [];
    const bcc_array = [];
    const attachment_array = [];

    for (let i = 0; i < cc.length; i++) {
      cc_array.push({
        emailAddress: {
          address: cc[i],
        },
      });
    }
    for (let i = 0; i < bcc.length; i++) {
      bcc_array.push({
        emailAddress: {
          address: bcc[i],
        },
      });
    }

    if (attachments) {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        attachment_array.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.filename,
          contentType: attachment.type,
          contentBytes: attachment.content.replace(/^data:.+;base64,/, ''),
        });
      }
    }

    let html_content;
    if (cc.length > 0 || bcc.length > 0) {
      html_content =
        '<html><head><title>Email</title></head><body><p>' +
        email_content +
        '</p><br/><br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';
    } else {
      html_content =
        '<html><head><title>Email</title></head><body><p>' +
        email_content +
        emailHelper.generateOpenTrackLink(activity.id) +
        '</p><br/><br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id) +
        '</body></html>';
    }

    const sendMail = {
      message: {
        subject: email_subject,
        from: {
          emailAddress: {
            name: currentUser.user_name,
            address: currentUser.connected_email,
          },
        },
        body: {
          contentType: 'HTML',
          content: html_content,
        },
        toRecipients: [
          {
            emailAddress: {
              address: _contact.email,
            },
          },
        ],
        ccRecipients: cc_array,
        bccRecipients: bcc_array,
        attachments: attachment_array,
      },
      saveToSentItems: 'true',
    };

    promise = new Promise((resolve, reject) => {
      client
        .api('/me/sendMail')
        .post(sendMail)
        .then(() => {
          email_count += 1;
          Contact.udpateOne(
            { _id: contacts[i] },
            {
              $set: { last_activity: activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
          resolve();
        })
        .catch((err) => {
          console.log('outlook err', err.message);
          Activity.deleteOne({ _id: activity.id }).catch((err) => {
            console.log('err', err);
          });
          if (err.code === 'ErrorMessageSubmissionBlocked') {
            reject(
              err.message ||
                'Please go to the login into your Email box and follow instruction'
            );
          } else {
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err,
            });
            resolve();
          }
        });
    });

    promise_array.push(promise);
  }

  Promise.all(promise_array)
    .then(() => {
      if (error.length > 0) {
        return res.status(405).json({
          status: false,
          error,
        });
      } else {
        return res.send({
          status: true,
        });
      }
    })
    .catch((err) => {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

const openTrack = async (req, res) => {
  const message_id = req.params.id;
  const _email = await Email.findOne({ message_id }).catch((err) => {
    console.log('err', err);
  });
  const user = await User.findOne({ _id: _email.user }).catch((err) => {
    console.log('err', err);
  });

  const contact = await Contact.findOne({ _id: _email.contacts }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  const opened = new Date();
  if (contact && user) {
    const created_at = moment(opened)
      .utcOffset(user.time_zone)
      .format('h:mm a');
    const action = 'opened';
    const email_activity = await Activity.findOne({
      contacts: contact.id,
      emails: _email.id,
    }).catch((err) => {
      console.log('err', err);
    });

    let reopened = moment();
    reopened = reopened.subtract(1, 'hours');
    const old_activity = await EmailTracker.findOne({
      activity: email_activity.id,
      type: 'open',
      created_at: { $gte: reopened },
    }).catch((err) => {
      console.log('err', err);
    });

    if (!old_activity) {
      const email_tracker = new EmailTracker({
        user: user.id,
        contact: contact.id,
        email: _email.id,
        type: 'open',
        activity: email_activity.id,
        updated_at: opened,
        created_at: opened,
      });

      const _email_tracker = await email_tracker
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });

      const activity = new Activity({
        content: 'opened email',
        contacts: contact.id,
        user: user.id,
        type: 'email_trackers',
        emails: _email.id,
        email_trackers: _email_tracker.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const _activity = await activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });

      Contact.update(
        { _id: contact.id },
        { $set: { last_activity: _activity.id } }
      ).catch((err) => {
        console.log('err', err);
      });

      const garbage = await Garbage.findOne({ user: user.id }).catch((err) => {
        console.log('err', err);
      });
      const email_notification = garbage['email_notification'];

      if (email_notification['email']) {
        sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
        const msg = {
          to: user.email,
          from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
          templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
          dynamic_template_data: {
            subject: `${mail_contents.NOTIFICATION_OPENED_EMAIL.SUBJECT}- ${contact.first_name} ${contact.last_name} at ${created_at}`,
            first_name: contact.first_name,
            last_name: contact.last_name,
            phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
            email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
            activity:
              contact.first_name +
              ' ' +
              action +
              ' email: ' +
              _email.subject +
              ' at ' +
              created_at,
            detailed_activity:
              "<a href='" +
              urls.CONTACT_PAGE_URL +
              contact.id +
              "'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/contact.png'/></a>",
          },
        };
        sgMail.send(msg).catch((err) => console.error(err));
      }
      const desktop_notification = garbage['desktop_notification'];
      if (desktop_notification['email']) {
        webpush.setVapidDetails(
          'mailto:support@crmgrow.com',
          api.VAPID.PUBLIC_VAPID_KEY,
          api.VAPID.PRIVATE_VAPID_KEY
        );

        const subscription = JSON.parse(user.desktop_notification_subscription);
        const title =
          contact.first_name +
          ' ' +
          contact.last_name +
          ' - ' +
          contact.email +
          ' ' +
          action +
          ' email';
        const created_at =
          moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') +
          ' at ' +
          moment(opened).utcOffset(user.time_zone).format('h:mm a');
        const body =
          contact.first_name +
          ' ' +
          contact.last_name +
          ' - ' +
          contact.email +
          ' ' +
          action +
          ' email: ' +
          _email.subject +
          ' on ' +
          created_at;
        const playload = JSON.stringify({
          notification: {
            title,
            body,
            icon: '/fav.ico',
            badge: '/fav.ico',
          },
        });
        webpush
          .sendNotification(subscription, playload)
          .catch((err) => console.error(err));
      }
      const text_notification = garbage['text_notification'];
      if (text_notification['email']) {
        const e164Phone = phone(user.cell_phone)[0];

        if (!e164Phone) {
          const error = {
            error: 'Invalid Phone Number',
          };

          throw error; // Invalid phone number
        } else {
          let fromNumber = user['proxy_number'];
          if (!fromNumber) {
            const areaCode = user.cell_phone.substring(1, 4);

            const data = await twilio.availablePhoneNumbers('US').local.list({
              areaCode,
            });

            let number = data[0];

            if (typeof number === 'undefined') {
              const areaCode1 = user.cell_phone.substring(1, 3);

              const data1 = await twilio
                .availablePhoneNumbers('US')
                .local.list({
                  areaCode: areaCode1,
                });
              number = data1[0];
            }

            if (typeof number !== 'undefined') {
              const proxy_number = await twilio.incomingPhoneNumbers.create({
                phoneNumber: number.phoneNumber,
                smsUrl: urls.SMS_RECEIVE_URL,
              });

              console.log('proxy_number', proxy_number);
              user['proxy_number'] = proxy_number.phoneNumber;
              fromNumber = user['proxy_number'];
              user.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              fromNumber = api.TWILIO.TWILIO_NUMBER;
            }
          }

          const title =
            contact.first_name +
            ' ' +
            contact.last_name +
            '\n' +
            contact.email +
            '\n' +
            contact.cell_phone +
            '\n' +
            '\n' +
            action +
            ' email: ' +
            '\n' +
            _email.subject +
            '\n';
          const created_at =
            moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') +
            ' at ' +
            moment(opened).utcOffset(user.time_zone).format('h:mm a');
          const time = ' on ' + created_at + '\n ';
          const contact_link = urls.CONTACT_PAGE_URL + contact.id;
          twilio.messages
            .create({
              from: fromNumber,
              body: title + '\n' + time + contact_link,
              to: e164Phone,
            })
            .catch((err) => {
              console.log('send sms err: ', err);
            });
        }
      }
    }
  }
  const contentType = mime.contentType(path.extname(TRAKER_PATH));
  res.set('Content-Type', contentType);
  return res.sendFile(TRAKER_PATH);
};

const bulkEmail = async (req, res) => {
  sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

  const { currentUser } = req;
  const { to, cc, bcc, contacts, content, attachments, subject } = req.body;

  const promise_array = [];
  const error = [];

  let email_count = currentUser['email_info']['count'] || 0;
  const max_email_count =
    currentUser['email_info']['max_count'] ||
    system_settings.EMAIL_DAILY_LIMIT.BASIC;

  for (let i = 0; i < contacts.length; i++) {
    let email_content = content;
    let email_subject = subject;
    let promise;

    let _contact = await Contact.findOne({
      _id: contacts[i],
      tags: { $nin: ['unsubscribed'] },
    }).catch((err) => {
      console.log('contact found err', err.message);
    });

    if (!_contact) {
      _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
        console.log('contact found err', err.message);
      });
      promise = new Promise(async (resolve, reject) => {
        error.push({
          contact: {
            first_name: _contact.first_name,
            email: _contact.email,
          },
          err: 'contact email not found or unsubscribed',
        });
        resolve();
      });
      promise_array.push(promise);
      continue;
    }

    const email_info = currentUser['email_info'];
    if (email_info['is_limit'] && email_count > max_email_count) {
      promise = new Promise((resolve, reject) => {
        error.push({
          contact: {
            first_name: _contact.first_name,
            email: _contact.email,
          },
          err: 'email daily limit exceed!',
        });
        resolve();
      });
      promise_array.push(promise);
      continue;
    }

    email_subject = email_subject
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    email_content = email_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.first_name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email)
      .replace(/{contact_phone}/gi, _contact.cell_phone);

    const email = new Email({
      ...req.body,
      content: email_content,
      subject: email_subject,
      contacts: contacts[i],
      user: currentUser.id,
      updated_at: new Date(),
      created_at: new Date(),
    });

    const _email = await email
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });

    const _activity = new Activity({
      content: 'sent email',
      contacts: contacts[i],
      user: currentUser.id,
      type: 'emails',
      emails: _email.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const activity = await _activity.save().then();

    const msg = {
      from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
      to: _contact.email,
      replyTo: currentUser.connected_email,
      subject: email_subject,
      bcc,
      cc,
      attachments,
      html:
        email_content +
        '<br/><br/>' +
        currentUser.email_signature +
        emailHelper.generateUnsubscribeLink(activity.id),
      text: email_content,
      headers: {
        'List-Unsubscribe': `<${urls.UNSUBSCRIPTION_URL}${activity.id}>`,
      },
    };

    promise = new Promise((resolve, reject) => {
      sgMail
        .send(msg)
        .then(async (_res) => {
          if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
            Email.updateMany(
              { _id: _email.id },
              { $set: { message_id: _res[0].headers['x-message-id'] } }
            ).catch((err) => {
              console.log('email update err', err);
            });

            email_count += 1;
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('contact err', err);
            });
            resolve();
          } else {
            console.log('email sending err', msg.to + _res[0].statusCode);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: _res[0].statusCode,
            });
            resolve();
          }
        })
        .catch((err) => {
          console.log('email sending err', err.message);
          Activity.deleteOne({ _id: activity.id }).catch((err) => {
            console.log('err', err);
          });
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email,
            },
            err,
          });
          resolve();
        });
    });
    promise_array.push(promise);
  }
  Promise.all(promise_array)
    .then(() => {
      if (error.length > 0) {
        return res.status(405).json({
          status: false,
          error,
        });
      }
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

const bulkYahoo = async (req, res) => {
  const { currentUser } = req;
  const mailOptions = {
    from: 'garrettsteve1@yahoo.com',
    to: 'amazingskill8001@gmail.com',
    subject: 'test again',
    text: 'Test',
    html: '<p>Test</p>',
  };

  console.log('yahoo.....', currentUser.yahoo_refresh_token);
  const transporter = nodemailer.createTransport({
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secureConnection: true,
    service: 'Yahoo',
    auth: {
      type: 'oauth2',
      user: 'garrettsteve1@yahoo.com',
      clientId: api.YAHOO_CLIENT.YAHOO_CLIENT_ID,
      clientSecret: api.YAHOO_CLIENT.YAHOO_CLIENT_CECRET,
      refreshToken: currentUser.yahoo_refresh_token,
    },
  });
  transporter.sendMail(mailOptions, (err, res) => {
    if (err) {
      return console.log(err);
    } else {
      console.log(JSON.stringify(res));
    }
  });
};

const receiveEmailSendGrid = async (req, res) => {
  const message_id = req.body[0].sg_message_id.split('.')[0];
  const event = req.body[0].event;
  const email = req.body[0].email;
  const time_stamp = req.body[0].timestamp;
  const _email = await Email.findOne({ message_id }).catch((err) => {
    console.log('err', err);
  });
  if (_email) {
    const user = await User.findOne({ _id: _email.user }).catch((err) => {
      console.log('err', err);
    });

    let contact;
    if (user) {
      contact = await Contact.findOne({ email, user: user.id }).catch((err) => {
        console.log('err', err);
      });
    }

    if (contact && user) {
      const opened = new Date(time_stamp * 1000);
      const created_at = moment(opened)
        .utcOffset(user.time_zone)
        .format('h:mm a');
      let action = '';
      if (event === 'open') {
        action = 'opened';
        const email_activity = await Activity.findOne({
          contacts: contact.id,
          emails: _email.id,
        }).catch((err) => {
          console.log('err', err);
        });

        const reopened = new Date(time_stamp * 1000 - 60 * 60 * 1000);
        const old_activity = await EmailTracker.findOne({
          activity: email_activity.id,
          type: 'open',
          created_at: { $gte: reopened },
        }).catch((err) => {
          console.log('err', err.message);
        });

        if (!old_activity) {
          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: _email.id,
            type: 'open',
            activity: email_activity.id,
            updated_at: opened,
            created_at: opened,
          });
          const _email_tracker = await email_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          const activity = new Activity({
            content: 'opened email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: _email.id,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });

          const _activity = await activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          Contact.update(
            { _id: contact.id },
            { $set: { last_activity: _activity.id } }
          ).catch((err) => {
            console.log('err', err);
          });
        } else {
          return;
        }
      }
      if (event === 'click') {
        action = 'clicked the link on';
        const email_activity = await Activity.findOne({
          contacts: contact.id,
          emails: _email.id,
        }).catch((err) => {
          console.log('err', err);
        });
        const reclicked = new Date(time_stamp * 1000 - 60 * 60 * 1000);
        const old_activity = await EmailTracker.findOne({
          activity: email_activity.id,
          type: 'click',
          created_at: { $gte: reclicked },
        }).catch((err) => {
          console.log('err', err);
        });

        if (old_activity) {
          return;
        }
        const email_tracker = new EmailTracker({
          user: user.id,
          contact: contact.id,
          email: _email.id,
          type: 'click',
          activity: email_activity.id,
          updated_at: opened,
          created_at: opened,
        });
        const _email_tracker = await email_tracker
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const activity = new Activity({
          content: 'clicked the link on email',
          contacts: contact.id,
          user: user.id,
          type: 'email_trackers',
          emails: _email.id,
          email_trackers: _email_tracker.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.findByIdAndUpdate(contact.id, {
          $set: { last_activity: _activity.id },
        }).catch((err) => {
          console.log('err', err);
        });
      }
      if (event === 'unsubscribe') {
        action = 'unsubscribed';
        const email_activity = await Activity.findOne({
          contacts: contact.id,
          emails: _email.id,
        }).catch((err) => {
          console.log('err', err);
        });
        const email_tracker = new EmailTracker({
          user: user.id,
          contact: contact.id,
          email: _email.id,
          type: 'unsubscribe',
          activity: email_activity.id,
          updated_at: opened,
          created_at: opened,
        });
        const _email_tracker = await email_tracker
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const activity = new Activity({
          content: 'unsubscribed email',
          contacts: contact.id,
          user: user.id,
          type: 'email_trackers',
          emails: _email.id,
          email_trackers: _email_tracker.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.update(
          { _id: contact.id },
          {
            $set: { last_activity: _activity.id },
            $push: { tags: { $each: ['unsubscribed'] } },
          }
        ).catch((err) => {
          console.log('err', err);
        });
      }
      const garbage = await Garbage.findOne({ user: user.id }).catch((err) => {
        console.log('console garbage found err', err.message);
      });
      const email_notification = garbage['email_notification'];

      if (email_notification['email']) {
        sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
        const msg = {
          to: user.email,
          from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
          templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
          dynamic_template_data: {
            subject: mail_contents.NOTIFICATION_OPENED_EMAIL.SUBJECT,
            first_name: contact.first_name,
            last_name: contact.last_name,
            phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
            email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
            activity:
              contact.first_name +
              ' ' +
              action +
              ' email: ' +
              _email.subject +
              ' at ' +
              created_at,
            detailed_activity:
              "<a href='" +
              urls.CONTACT_PAGE_URL +
              contact.id +
              "'><img src='" +
              urls.DOMAIN_URL +
              "assets/images/contact.png'/></a>",
          },
        };
        sgMail.send(msg).catch((err) => console.error(err));
      }
      const desktop_notification = garbage['desktop_notification'];
      if (desktop_notification['email']) {
        webpush.setVapidDetails(
          'mailto:support@crmgrow.com',
          api.VAPID.PUBLIC_VAPID_KEY,
          api.VAPID.PRIVATE_VAPID_KEY
        );

        const subscription = JSON.parse(user.desktop_notification_subscription);
        const title =
          contact.first_name +
          ' ' +
          contact.last_name +
          ' - ' +
          contact.email +
          ' ' +
          action +
          ' email';
        const created_at =
          moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') +
          ' at ' +
          moment(opened).utcOffset(user.time_zone).format('h:mm a');
        const body =
          contact.first_name +
          ' ' +
          contact.last_name +
          ' - ' +
          contact.email +
          ' ' +
          action +
          ' email: ' +
          _email.subject +
          ' on ' +
          created_at;
        const playload = JSON.stringify({
          notification: {
            title,
            body,
            icon: '/fav.ico',
            badge: '/fav.ico',
          },
        });
        webpush
          .sendNotification(subscription, playload)
          .catch((err) => console.error(err));
      }
      const text_notification = garbage['text_notification'];
      if (text_notification['email']) {
        const e164Phone = phone(user.cell_phone)[0];

        if (!e164Phone) {
          const error = {
            error: 'Invalid Phone Number',
          };

          throw error; // Invalid phone number
        } else {
          let fromNumber = user['proxy_number'];
          if (!fromNumber) {
            const areaCode = user.cell_phone.substring(1, 4);

            const data = await twilio.availablePhoneNumbers('US').local.list({
              areaCode,
            });

            let number = data[0];

            if (typeof number === 'undefined') {
              const areaCode1 = user.cell_phone.substring(1, 3);

              const data1 = await twilio
                .availablePhoneNumbers('US')
                .local.list({
                  areaCode: areaCode1,
                });
              number = data1[0];
            }

            if (typeof number !== 'undefined') {
              const proxy_number = await twilio.incomingPhoneNumbers.create({
                phoneNumber: number.phoneNumber,
                smsUrl: urls.SMS_RECEIVE_URL,
              });

              console.log('proxy_number', proxy_number);
              user['proxy_number'] = proxy_number.phoneNumber;
              fromNumber = user['proxy_number'];
              user.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              fromNumber = system_settings.TWILIO.TWILIO_NUMBER;
            }
          }

          const title =
            contact.first_name +
            ' ' +
            contact.last_name +
            '\n' +
            contact.email +
            '\n' +
            contact.cell_phone +
            '\n' +
            '\n' +
            action +
            ' email: ' +
            '\n' +
            _email.subject +
            '\n';
          const created_at =
            moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') +
            ' at ' +
            moment(opened).utcOffset(user.time_zone).format('h:mm a');
          const time = ' on ' + created_at + '\n ';
          const contact_link = urls.CONTACT_PAGE_URL + contact.id;
          twilio.messages
            .create({
              from: fromNumber,
              body: title + '\n' + time + contact_link,
              to: e164Phone,
            })
            .catch((err) => {
              console.log('send sms err: ', err);
            });
        }
      }
    }
  }

  return res.send({
    status: true,
  });
};

const receiveEmail = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id }).catch(
    (err) => {
      console.log('activity finding err', err);
    }
  );

  console.log('email opend id', req.params.id);
  if (activity) {
    const user = await User.findOne({ _id: activity.user }).catch((err) => {
      console.log('err', err);
    });

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const opened = new Date();
    if (contact && user) {
      const _email = await Email.findOne({ _id: activity.emails }).catch(
        (err) => {
          console.log('email finding err', err);
        }
      );
      const created_at = moment(opened)
        .utcOffset(user.time_zone)
        .format('h:mm a');
      const action = 'opened';
      const email_activity = await Activity.findOne({
        contacts: contact.id,
        emails: _email.id,
      }).catch((err) => {
        console.log('err', err);
      });

      let reopened = moment();
      reopened = reopened.subtract(1, 'hours');
      const old_activity = await EmailTracker.findOne({
        activity: email_activity.id,
        type: 'open',
        created_at: { $gte: reopened },
      }).catch((err) => {
        console.log('err', err);
      });

      if (!old_activity) {
        const email_tracker = new EmailTracker({
          user: user.id,
          contact: contact.id,
          email: _email.id,
          type: 'open',
          activity: email_activity.id,
          updated_at: opened,
          created_at: opened,
        });

        const _email_tracker = await email_tracker
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const activity = new Activity({
          content: 'opened email',
          contacts: contact.id,
          user: user.id,
          type: 'email_trackers',
          emails: _email.id,
          email_trackers: _email_tracker.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        const _activity = await activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        Contact.update(
          { _id: contact.id },
          { $set: { last_activity: _activity.id } }
        ).catch((err) => {
          console.log('err', err);
        });

        const garbage = await Garbage.findOne({ user: user.id }).catch(
          (err) => {
            console.log('err', err);
          }
        );
        const email_notification = garbage['email_notification'];

        if (email_notification['email']) {
          sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
          const msg = {
            to: user.email,
            from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
            templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
            dynamic_template_data: {
              subject: `${mail_contents.NOTIFICATION_OPENED_EMAIL.SUBJECT}- ${contact.first_name} ${contact.last_name} at ${created_at}`,
              first_name: contact.first_name,
              last_name: contact.last_name,
              phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
              email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
              activity:
                contact.first_name +
                ' ' +
                action +
                ' email: ' +
                _email.subject +
                ' at ' +
                created_at,
              detailed_activity:
                "<a href='" +
                urls.CONTACT_PAGE_URL +
                contact.id +
                "'><img src='" +
                urls.DOMAIN_URL +
                "assets/images/contact.png'/></a>",
            },
          };
          sgMail.send(msg).catch((err) => console.error(err));
        }

        const desktop_notification = garbage['desktop_notification'];

        if (desktop_notification['email']) {
          webpush.setVapidDetails(
            'mailto:support@crmgrow.com',
            api.VAPID.PUBLIC_VAPID_KEY,
            api.VAPID.PRIVATE_VAPID_KEY
          );

          const subscription = JSON.parse(
            user.desktop_notification_subscription
          );
          const title =
            contact.first_name +
            ' ' +
            contact.last_name +
            ' - ' +
            contact.email +
            ' ' +
            action +
            ' email';
          const created_at =
            moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') +
            ' at ' +
            moment(opened).utcOffset(user.time_zone).format('h:mm a');
          const body =
            contact.first_name +
            ' ' +
            contact.last_name +
            ' - ' +
            contact.email +
            ' ' +
            action +
            ' email: ' +
            _email.subject +
            ' on ' +
            created_at;
          const playload = JSON.stringify({
            notification: {
              title,
              body,
              icon: '/fav.ico',
              badge: '/fav.ico',
            },
          });
          webpush
            .sendNotification(subscription, playload)
            .catch((err) => console.error(err));
        }
        const text_notification = garbage['text_notification'];
        if (text_notification['email']) {
          const e164Phone = phone(user.cell_phone)[0];

          if (!e164Phone) {
            const error = {
              error: 'Invalid Phone Number',
            };

            throw error; // Invalid phone number
          } else {
            let fromNumber = user['proxy_number'];
            if (!fromNumber) {
              const areaCode = user.cell_phone.substring(1, 4);

              const data = await twilio.availablePhoneNumbers('US').local.list({
                areaCode,
              });

              let number = data[0];

              if (typeof number === 'undefined') {
                const areaCode1 = user.cell_phone.substring(1, 3);

                const data1 = await twilio
                  .availablePhoneNumbers('US')
                  .local.list({
                    areaCode: areaCode1,
                  });
                number = data1[0];
              }

              if (typeof number !== 'undefined') {
                const proxy_number = await twilio.incomingPhoneNumbers.create({
                  phoneNumber: number.phoneNumber,
                  smsUrl: urls.SMS_RECEIVE_URL,
                });

                console.log('proxy_number', proxy_number);
                user['proxy_number'] = proxy_number.phoneNumber;
                fromNumber = user['proxy_number'];
                user.save().catch((err) => {
                  console.log('err', err);
                });
              } else {
                fromNumber = api.TWILIO.TWILIO_NUMBER;
              }
            }

            const title =
              contact.first_name +
              ' ' +
              contact.last_name +
              '\n' +
              contact.email +
              '\n' +
              contact.cell_phone +
              '\n' +
              '\n' +
              action +
              ' email: ' +
              '\n' +
              _email.subject +
              '\n';
            const created_at =
              moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') +
              ' at ' +
              moment(opened).utcOffset(user.time_zone).format('h:mm a');
            const time = ' on ' + created_at + '\n ';
            const contact_link = urls.CONTACT_PAGE_URL + contact.id;
            twilio.messages
              .create({
                from: fromNumber,
                body: title + '\n' + time + contact_link,
                to: e164Phone,
              })
              .catch((err) => {
                console.log('send sms err: ', err);
              });
          }
        }
      }
    }
  }

  const contentType = mime.contentType(path.extname(TRAKER_PATH));
  res.set('Content-Type', contentType);
  res.sendFile(TRAKER_PATH);
};

const unSubscribeEmail = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id }).catch(
    (err) => {
      console.log('activity finding err', err);
    }
  );

  let _activity;
  if (activity) {
    const user = await User.findOne({ _id: activity.user }).catch((err) => {
      console.log('err', err);
    });

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const action = 'unsubscribed';

    if (user && contact) {
      const activity_type = activity.type;
      switch (activity_type) {
        case 'emails': {
          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: activity.emails,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _email_tracker = await email_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('email tracker save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: activity.emails,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'videos': {
          const video_tracker = new VideoTracker({
            user: user.id,
            contact: contact.id,
            video: activity.videos,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _video_tracker = await video_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('video track save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed video email',
            contacts: contact.id,
            user: user.id,
            type: 'video_trackers',
            videos: activity.videos,
            video_trackers: _video_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'pdfs': {
          const pdf_tracker = new PDFTracker({
            user: user.id,
            contact: contact.id,
            pdf: activity.pdfs,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _pdf_tracker = await pdf_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('pdf track save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed pdf email',
            contacts: contact.id,
            user: user.id,
            type: 'pdf_trackers',
            pdfs: activity.pdfs,
            pdf_trackers: _pdf_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'images': {
          const image_tracker = new ImageTracker({
            user: user.id,
            contact: contact.id,
            image: activity.images,
            type: 'unsubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _image_tracker = await image_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('image track save error', err.message);
            });

          _activity = new Activity({
            content: 'unsubscribed image email',
            contacts: contact.id,
            user: user.id,
            type: 'image_trackers',
            images: activity.images,
            image_trackers: _image_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        default:
          break;
      }
    }

    const last_activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
      });
    Contact.update(
      { _id: contact.id },
      {
        $set: { last_activity: last_activity.id },
        $push: { tags: { $each: ['unsubscribed'] } },
      }
    ).catch((err) => {
      console.log('err', err);
    });

    const unsubscribed = new Date();
    const created_at = moment(unsubscribed)
      .utcOffset(user.time_zone)
      .format('h:mm a');

    const garbage = await Garbage.findOne({ user: user.id }).catch((err) => {
      console.log('err', err);
    });

    const email_notification = garbage['email_notification'];

    if (email_notification['unsubscription']) {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
      const msg = {
        to: user.email,
        from: mail_contents.NOTIFICATION_UNSUBSCRIPTION.MAIL,
        templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
        dynamic_template_data: {
          subject: `${mail_contents.NOTIFICATION_UNSUBSCRIPTION.SUBJECT}- ${contact.first_name} ${contact.last_name} at ${created_at}`,
          first_name: contact.first_name,
          last_name: contact.last_name,
          phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
          email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
          activity:
            contact.first_name + ' ' + action + ' email at ' + created_at,
          detailed_activity:
            "<a href='" +
            urls.CONTACT_PAGE_URL +
            contact.id +
            "'><img src='" +
            urls.DOMAIN_URL +
            "assets/images/contact.png'/></a>",
        },
      };
      sgMail.send(msg).catch((err) => console.error(err));
    }

    const desktop_notification = garbage['desktop_notification'];

    if (desktop_notification['unsubscription']) {
      webpush.setVapidDetails(
        'mailto:support@crmgrow.com',
        api.VAPID.PUBLIC_VAPID_KEY,
        api.VAPID.PRIVATE_VAPID_KEY
      );

      const subscription = JSON.parse(user.desktop_notification_subscription);
      const title =
        contact.first_name +
        ' ' +
        contact.last_name +
        ' - ' +
        contact.email +
        ' ' +
        action +
        ' email';
      const created_at =
        moment(unsubscribed).utcOffset(user.time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment(unsubscribed).utcOffset(user.time_zone).format('h:mm a');
      const body =
        contact.first_name +
        ' ' +
        contact.last_name +
        ' - ' +
        contact.email +
        ' ' +
        action +
        ' email: ' +
        ' on ' +
        created_at;
      const playload = JSON.stringify({
        notification: {
          title,
          body,
          icon: '/fav.ico',
          badge: '/fav.ico',
        },
      });
      webpush
        .sendNotification(subscription, playload)
        .catch((err) => console.error(err));
    }
    const text_notification = garbage['text_notification'];
    if (text_notification['unsubscription']) {
      const e164Phone = phone(user.cell_phone)[0];

      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number',
        };

        throw error; // Invalid phone number
      } else {
        let fromNumber = user['proxy_number'];
        if (!fromNumber) {
          const areaCode = user.cell_phone.substring(1, 4);

          const data = await twilio.availablePhoneNumbers('US').local.list({
            areaCode,
          });

          let number = data[0];

          if (typeof number === 'undefined') {
            const areaCode1 = user.cell_phone.substring(1, 3);

            const data1 = await twilio.availablePhoneNumbers('US').local.list({
              areaCode: areaCode1,
            });
            number = data1[0];
          }

          if (typeof number !== 'undefined') {
            const proxy_number = await twilio.incomingPhoneNumbers.create({
              phoneNumber: number.phoneNumber,
              smsUrl: urls.SMS_RECEIVE_URL,
            });

            console.log('proxy_number', proxy_number);
            user['proxy_number'] = proxy_number.phoneNumber;
            fromNumber = user['proxy_number'];
            user.save().catch((err) => {
              console.log('err', err);
            });
          } else {
            fromNumber = api.TWILIO.TWILIO_NUMBER;
          }
        }

        const title =
          contact.first_name +
          ' ' +
          contact.last_name +
          '\n' +
          contact.email +
          '\n' +
          contact.cell_phone +
          '\n' +
          '\n' +
          action +
          ' email:' +
          '\n';
        const created_at =
          moment(unsubscribed).utcOffset(user.time_zone).format('MM/DD/YYYY') +
          ' at ' +
          moment(unsubscribed).utcOffset(user.time_zone).format('h:mm a');
        const time = ' on ' + created_at + '\n ';
        const contact_link = urls.CONTACT_PAGE_URL + contact.id;
        twilio.messages
          .create({
            from: fromNumber,
            body: title + '\n' + time + contact_link,
            to: e164Phone,
          })
          .catch((err) => {
            console.log('send sms err: ', err);
          });
      }
    }
  }
  res.send('You successfully unsubscribed CRMGrow email');
};

const reSubscribeEmail = async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id }).catch(
    (err) => {
      console.log('activity finding err', err.message);
    }
  );

  let _activity;
  if (activity) {
    const user = await User.findOne({ _id: activity.user }).catch((err) => {
      console.log('err', err.message);
    });

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err.message);
      }
    );

    const action = 'resubscribed';

    if (user && contact) {
      const activity_type = activity.type;
      switch (activity_type) {
        case 'emails': {
          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: activity.emails,
            type: 'resubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _email_tracker = await email_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('email tracker save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: activity.emails,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'videos': {
          const video_tracker = new VideoTracker({
            user: user.id,
            contact: contact.id,
            video: activity.videos,
            type: 'resubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _video_tracker = await video_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('video track save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed video email',
            contacts: contact.id,
            user: user.id,
            type: 'video_trackers',
            videos: activity.videos,
            video_trackers: _video_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'pdfs': {
          const pdf_tracker = new PDFTracker({
            user: user.id,
            contact: contact.id,
            pdf: activity.pdfs,
            type: 'resubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _pdf_tracker = await pdf_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('pdf track save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed pdf email',
            contacts: contact.id,
            user: user.id,
            type: 'pdf_trackers',
            pdfs: activity.pdfs,
            pdf_trackers: _pdf_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        case 'images': {
          const image_tracker = new ImageTracker({
            user: user.id,
            contact: contact.id,
            image: activity.images,
            type: 'resubscribe',
            activity: activity.id,
            updated_at: new Date(),
            created_at: new Date(),
          });

          const _image_tracker = await image_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('image track save error', err.message);
            });

          _activity = new Activity({
            content: 'resubscribed image email',
            contacts: contact.id,
            user: user.id,
            type: 'image_trackers',
            images: activity.images,
            image_trackers: _image_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          break;
        }
        default:
          break;
      }
    }

    const last_activity = await _activity
      .save()
      .then()
      .catch((err) => {
        console.log('err', err.message);
      });
    Contact.update(
      { _id: contact.id },
      {
        $set: { last_activity: last_activity.id },
        $pull: { tags: { $in: ['unsubscribed'] } },
      }
    ).catch((err) => {
      console.log('err', err.message);
    });

    const resubscribed = new Date();
    const created_at = moment(resubscribed)
      .utcOffset(user.time_zone)
      .format('h:mm a');

    const garbage = await Garbage.findOne({ user: user.id }).catch((err) => {
      console.log('err', err);
    });

    const email_notification = garbage['email_notification'];

    if (email_notification['resubscription']) {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);
      const msg = {
        to: user.email,
        from: mail_contents.NOTIFICATION_UNSUBSCRIPTION.MAIL,
        templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
        dynamic_template_data: {
          subject: `${mail_contents.NOTIFICATION_UNSUBSCRIPTION.SUBJECT}- ${contact.first_name} ${contact.last_name} at ${created_at}`,
          first_name: contact.first_name,
          last_name: contact.last_name,
          phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
          email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
          activity:
            contact.first_name + ' ' + action + ' email at ' + created_at,
          detailed_activity:
            "<a href='" +
            urls.CONTACT_PAGE_URL +
            contact.id +
            "'><img src='" +
            urls.DOMAIN_URL +
            "assets/images/contact.png'/></a>",
        },
      };
      sgMail.send(msg).catch((err) => console.error(err));
    }

    const desktop_notification = garbage['desktop_notification'];

    if (desktop_notification['resubscription']) {
      webpush.setVapidDetails(
        'mailto:support@crmgrow.com',
        api.VAPID.PUBLIC_VAPID_KEY,
        api.VAPID.PRIVATE_VAPID_KEY
      );

      const subscription = JSON.parse(user.desktop_notification_subscription);
      const title =
        contact.first_name +
        ' ' +
        contact.last_name +
        ' - ' +
        contact.email +
        ' ' +
        action +
        ' email';
      const created_at =
        moment(resubscribed).utcOffset(user.time_zone).format('MM/DD/YYYY') +
        ' at ' +
        moment(resubscribed).utcOffset(user.time_zone).format('h:mm a');
      const body =
        contact.first_name +
        ' ' +
        contact.last_name +
        ' - ' +
        contact.email +
        ' ' +
        action +
        ' email: ' +
        ' on ' +
        created_at;
      const playload = JSON.stringify({
        notification: {
          title,
          body,
          icon: '/fav.ico',
          badge: '/fav.ico',
        },
      });
      webpush
        .sendNotification(subscription, playload)
        .catch((err) => console.error(err));
    }
    const text_notification = garbage['text_notification'];
    if (text_notification['resubscription']) {
      const e164Phone = phone(user.cell_phone)[0];

      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number',
        };

        throw error; // Invalid phone number
      } else {
        let fromNumber = user['proxy_number'];
        if (!fromNumber) {
          const areaCode = user.cell_phone.substring(1, 4);

          const data = await twilio.availablePhoneNumbers('US').local.list({
            areaCode,
          });

          let number = data[0];

          if (typeof number === 'undefined') {
            const areaCode1 = user.cell_phone.substring(1, 3);

            const data1 = await twilio.availablePhoneNumbers('US').local.list({
              areaCode: areaCode1,
            });
            number = data1[0];
          }

          if (typeof number !== 'undefined') {
            const proxy_number = await twilio.incomingPhoneNumbers.create({
              phoneNumber: number.phoneNumber,
              smsUrl: urls.SMS_RECEIVE_URL,
            });

            console.log('proxy_number', proxy_number);
            user['proxy_number'] = proxy_number.phoneNumber;
            fromNumber = user['proxy_number'];
            user.save().catch((err) => {
              console.log('err', err);
            });
          } else {
            fromNumber = api.TWILIO.TWILIO_NUMBER;
          }
        }

        const title =
          contact.first_name +
          ' ' +
          contact.last_name +
          '\n' +
          contact.email +
          '\n' +
          contact.cell_phone +
          '\n' +
          '\n' +
          action +
          ' email:' +
          '\n';
        const created_at =
          moment(resubscribed).utcOffset(user.time_zone).format('MM/DD/YYYY') +
          ' at ' +
          moment(resubscribed).utcOffset(user.time_zone).format('h:mm a');
        const time = ' on ' + created_at + '\n ';
        const contact_link = urls.CONTACT_PAGE_URL + contact.id;
        twilio.messages
          .create({
            from: fromNumber,
            body: title + '\n' + time + contact_link,
            to: e164Phone,
          })
          .catch((err) => {
            console.log('send sms err: ', err);
          });
      }
    }
  }
  res.send('You successfully resubscribed CRMGrow email');
};

const sharePlatform = async (req, res) => {
  sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

  const { currentUser } = req;
  const { contacts, content, subject } = req.body;

  const promise_array = [];
  const error = [];

  for (let i = 0; i < contacts.length; i++) {
    let email_content = content;
    let email_subject = subject;
    const _contact = contacts[i];

    email_subject = email_subject
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email);

    email_content = email_content
      .replace(/{user_name}/gi, currentUser.user_name)
      .replace(/{user_email}/gi, currentUser.connected_email)
      .replace(/{user_phone}/gi, currentUser.cell_phone)
      .replace(/{contact_first_name}/gi, _contact.name)
      .replace(/{contact_last_name}/gi, _contact.last_name)
      .replace(/{contact_email}/gi, _contact.email);

    const msg = {
      from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
      to: _contact.email,
      replyTo: currentUser.connected_email,
      subject: email_subject,
      html: email_content + '<br/><br/>' + currentUser.email_signature,
      text: email_content,
    };

    const promise = new Promise((resolve, reject) => {
      sgMail
        .send(msg)
        .then(async (_res) => {
          if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
            resolve();
          } else {
            error.push({
              contact: {
                first_name: _contact.name,
                email: _contact.email,
              },
              err: _res[0].statusCode,
            });
            resolve();
          }
        })
        .catch((err) => {
          error.push({
            contact: {
              first_name: _contact.name,
              email: _contact.email,
            },
            err,
          });
          resolve();
        });
    });
    promise_array.push(promise);
  }
  Promise.all(promise_array)
    .then(() => {
      if (error.length > 0) {
        return res.status(405).json({
          status: false,
          error,
        });
      }
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    });
};

module.exports = {
  openTrack,
  getGmail,
  bulkGmail,
  bulkYahoo,
  listGmail,
  bulkOutlook,
  bulkEmail,
  receiveEmailSendGrid,
  receiveEmail,
  unSubscribeEmail,
  reSubscribeEmail,
  sharePlatform,
};
