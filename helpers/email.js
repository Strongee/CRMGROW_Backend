const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const moment = require('moment');
const path = require('path');
const mime = require('mime-types');

const OAuth2 = google.auth.OAuth2;
const uuidv1 = require('uuid/v1');

var graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const Base64 = require('js-base64').Base64;
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const sgMail = require('@sendgrid/mail');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const EmailTracker = require('../models/email_tracker');
const User = require('../models/user');
const Video = require('../models/video');
const ActivityHelper = require('./activity');
const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const urls = require('../constants/urls');
const video = require('./video');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};
const oauth2 = require('simple-oauth2')(credentials);
const cheerio = require('cheerio');

const isBlockedEmail = (email) => {
  const mac = /^[a-z0-9](\.?[a-z0-9]){2,}@mac\.com$/;
  const me = /^[a-z0-9](\.?[a-z0-9]){2,}@me\.com$/;
  const icloud = /^[a-z0-9](\.?[a-z0-9]){2,}@icloud\.com$/;
  const yahoo = /^[a-z0-9](\.?[a-z0-9]){2,}@yahoo\.com$/;
  return (
    mac.test(String(email).toLowerCase()) ||
    me.test(String(email).toLowerCase()) ||
    icloud.test(String(email).toLowerCase()) ||
    yahoo.test(String(email).toLowerCase())
  );
};
const makeBody = (to, from, subject, message) => {
  var str = [
    'Content-Type: text/html; charset="UTF-8"\n',
    'MIME-Version:1.0\n',
    'Content-Transfer-Encoding: 7bit\n',
    'to: ',
    to,
    '\n',
    'from: ',
    from,
    '\n',
    'subject: ',
    subject,
    '\n\n',
    message,
  ].join('');
  var encodedMail = Base64.encodeURI(str);
  return encodedMail;
};

const bulkEmail = async (data) => {
  const { user, subject, content, bcc, cc, contacts } = data;
  const promise_array = [];

  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('user find err', err.message);
    }
  );

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          err: 'User not found',
        });
      })
    );
  }
  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent email';
  detail_content = ActivityHelper.automationLog(detail_content);

  if (!currentUser.primary_connected) {
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    for (let i = 0; i < contacts.length; i++) {
      let email_content = content;
      let email_subject = subject;
      let promise;

      let _contact = await Contact.findOne({
        _id: contacts[i],
        tags: { $nin: ['unsubscribed'] },
      }).catch((err) => {
        console.log('contact found err');
      });

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
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
          console.log('email found err', err.message);
        });

      const _activity = new Activity({
        content: detail_content,
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
        html:
          email_content +
          '<br/><br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id),
        text: email_content,
      };

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then(async (_res) => {
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              Email.updateOne(
                { _id: _email.id },
                { $set: { message_id: _res[0].headers['x-message-id'] } }
              ).catch((err) => {
                console.log('email update err', err.message);
              });

              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err.message);
              });

              resolve({
                status: true,
                activity: activity.id,
              });
            } else {
              console.log('email sending err', msg.to + _res[0].statusCode);
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('err', err);
              });
              resolve({
                status: false,
                contact: contacts[i],
                err: _res[0].message,
              });
            }
          })
          .catch((err) => {
            console.log('email sending err', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: false,
              contact: contacts[i],
              err: err.msg || err.message,
            });
          });
      });
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'gmail') {
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );

    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });

    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err: err.message,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

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
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              status: false,
              contact: contacts[i],
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
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
            console.log('email found err', err.message);
          });

        const _activity = new Activity({
          content: detail_content,
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
            console.log('err', err);
          });

        const html_content =
          '<html><head><title>Email</title></head><body><p>' +
          email_content +
          generateOpenTrackLink(activity.id) +
          '</p><br/><br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';

        promise = new Promise(async (resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: email_subject,
              },
              textHtml: html_content,
              textPlain: email_content,
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
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                )
                  .then(() => {
                    resolve({
                      status: true,
                      activity: activity.id,
                    });
                  })
                  .catch((err) => {
                    console.log(
                      'contact update err gmail helper 306',
                      err.message
                    );
                  });
              })
              .catch((err) => {
                console.log('gmail send err helper 309', err.message);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  contact: contacts[i],
                  err: err.message,
                });
              });
          } catch (err) {
            console.log('gmail send err helper', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              contact: contacts[i],
              err: err.message || err.mgs,
            });
          }
        }).catch((err) => {
          console.log('gmail promise err helper', err.message);
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            err: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'outlook') {
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;

    for (let i = 0; i < contacts.length; i++) {
      await new Promise((resolve, reject) => {
        token.refresh((error, result) => {
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
        .catch((err) => {
          console.log('outlook token grant error', err.message);
          promise_array.push(
            new Promise((resolve, reject) => {
              resolve({
                status: false,
                err: err.message,
              });
            })
          );
        });

      if (promise_array.length > 0) {
        return Promise.all(promise_array);
      }

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

      let _contact = await Contact.findOne({ _id: contacts[i] }).catch(
        (err) => {
          console.log('contact found err', err.message);
        }
      );

      if (!_contact) {
        _contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
          console.log('contact found err', err.message);
        });
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
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
        content: detail_content,
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

      const html_content =
        '<html><head><title>Email</title></head><body><p>' +
        email_content +
        generateOpenTrackLink(activity.id) +
        '</p><br/><br/>' +
        currentUser.email_signature +
        generateUnsubscribeLink(activity.id) +
        '</body></html>';

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
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(async () => {
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: true,
              activity: activity.id,
            });
          })
          .catch((err) => {
            console.log('bulk outlook err helper 493', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            if (err.code === 'ErrorMessageSubmissionBlocked') {
              resolve({
                status: false,
                contact: contacts[i],
                err:
                  err.message ||
                  'Please go to the login into your Email box and follow instruction',
              });
            } else {
              resolve({
                status: false,
                contact: contacts[i],
                err: err.message || err.msg,
              });
            }
          });
      });

      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  }
};

const bulkVideo = async (data) => {
  const { user, content, subject, videos, contacts } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  const promise_array = [];

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          err: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent video using email';
  detail_content = ActivityHelper.automationLog(detail_content);

  if (!currentUser.primary_connected) {
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email removed',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'];
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
          video_subject = video_subject.replace(
            /{material_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const msg = {
          to: _contact.email,
          from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
          replyTo: currentUser.connected_email,
          subject: video_subject,
          html:
            '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
            video_content +
            '<br/>Thank you,<br/>' +
            currentUser.email_signature +
            generateUnsubscribeLink(activity.id) +
            '</body></html>',
          text: video_content,
        };

        promise = new Promise((resolve, reject) => {
          sgMail
            .send(msg)
            .then(async (_res) => {
              console.log('mailres.errorcode', _res[0].statusCode);
              if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
                console.log('status', _res[0].statusCode);
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: true,
                });
              } else {
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                console.log('email sending err', msg.to + _res[0].statusCode);
                resolve({
                  status: false,
                  err: msg.to + _res[0].statusCode,
                  contact: contacts[i],
                });
              }
            })
            .catch((err) => {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('err', err);
              });
              console.log('email sending err', msg.to);
              console.error(err);
              resolve({
                status: false,
                err,
                contact: contacts[i],
              });
            });
        });
        promise_array.push(promise);
      }
    }

    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'gmail') {
    const promise_array = [];
    let promise;

    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message || err.msg);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'] + '-resize';
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err.message);
            });

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
          video_subject = video_subject.replace(
            /{material_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const email_content =
          '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
          video_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';

        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, video_subject, email_content );

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: video_subject,
              },
              textHtml: email_content,
              textPlain: video_content,
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
              .then(() => {
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('contact find err', err.message);
                });
                resolve({
                  status: true,
                });
              })
              .catch((err) => {
                console.log('err', err.message);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: false,
                  err,
                  contact: contacts[i],
                });
              });
          } catch (err) {
            console.log('err', err.message);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            resolve({
              status: false,
              err: err.message,
              contact: contacts[i],
            });
          }
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            err: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'outlook') {
    const promise_array = [];
    let promise;

    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;
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
      .catch((err) => {
        console.log('outlook token grant error', err.message || err.msg);
        promise_array.push(
          new Promise((resolve, reject) => {
            resolve({
              status: false,
              err: err.message || err.msg,
            });
          })
        );
      });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'] + '-resize';
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('activity found err', err.message);
            });

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const sendMail = {
          message: {
            subject: video_subject,
            body: {
              contentType: 'HTML',
              content:
                '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
                video_content +
                '<br/>Thank you,<br/>' +
                currentUser.email_signature +
                generateUnsubscribeLink(activity.id) +
                '</body></html>',
            },
            toRecipients: [
              {
                emailAddress: {
                  address: _contact.email,
                },
              },
            ],
          },
          saveToSentItems: 'true',
        };

        promise = new Promise((resolve, reject) => {
          client
            .api('/me/sendMail')
            .post(sendMail)
            .then(() => {
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err.message);
              });
              resolve({
                status: true,
              });
            })
            .catch((err) => {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('activity delete err', err.message);
              });
              console.log('outlook send err', err.message);
              resolve({
                status: false,
                contact: contacts[i],
                err: err.message,
              });
            });
        });
        promise_array.push(promise);
      }
    }

    return Promise.all(promise_array);
  }
};

const bulkPDF = async (data) => {
  const { user, content, subject, pdfs, contacts } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('user found err', err.message);
    }
  );

  const promise_array = [];

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          err: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent pdf using email';
  detail_content = ActivityHelper.automationLog(detail_content);

  if (!currentUser.primary_connected) {
    let promise;
    for (let i = 0; i < contacts.length; i++) {
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

        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact not found err',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      let activity;

      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('activity found err', err.message);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }
        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`
        const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`;
        pdf_objects += pdf_object;
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: pdf_subject,
        html:
          '<html><head><title>PDF Invitation</title></head><body><p style="white-space:pre-wrap;max-width:800px;margin-top:0px;">' +
          pdf_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>',
      };

      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              console.log('status', _res[0].statusCode);
              Contact.updateOne(
                { _id: contacts[i] },
                { $set: { last_activity: activity.id } }
              ).catch((err) => {
                console.log('contact found err', err.message);
              });
              resolve({
                status: true,
              });
            } else {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('activity delete err', err.message);
              });

              console.log('email sending err', msg.to + _res[0].statusCode);
              resolve({
                status: false,
                err: _res[0].statusCode,
                contact: contacts[i],
              });
            }
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            console.log('email sending err', err.message);
            resolve({
              status: false,
              err: err.message,
              contact: contacts[i],
            });
          });
      });
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'gmail') {
    let promise;
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact found err',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let pdf_titles = '';
        let pdf_descriptions = '';
        let pdf_objects = '';
        let pdf_subject = subject;
        let pdf_content = content;
        let activity;
        for (let j = 0; j < pdfs.length; j++) {
          const pdf = pdfs[j];

          if (typeof pdf_content === 'undefined') {
            pdf_content = '';
          }

          pdf_subject = pdf_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          pdf_content = pdf_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'pdfs',
            pdfs: pdf._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: pdf_subject,
            description: pdf_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

          if (pdfs.length >= 2) {
            pdf_titles = mail_contents.PDF_TITLE;
          } else {
            pdf_titles = `${pdf.title}`;
          }

          if (j < pdfs.length - 1) {
            pdf_descriptions += `${pdf.description}, `;
          } else {
            pdf_descriptions += pdf.description;
          }

          // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`
          const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`;
          pdf_objects += pdf_object;
        }

        if (pdf_subject === '') {
          pdf_subject = 'PDF: ' + pdf_titles;
        } else {
          pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
          pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
        }

        if (pdf_content.search(/{pdf_object}/gi) !== -1) {
          pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
        } else {
          pdf_content = pdf_content + '<br/>' + pdf_objects;
        }

        if (pdf_content.search(/{pdf_title}/gi) !== -1) {
          pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
        }

        if (pdf_content.search(/{pdf_description}/gi) !== -1) {
          pdf_content = pdf_content.replace(
            /{pdf_description}/gi,
            pdf_descriptions
          );
        }

        const email_content =
          '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
          pdf_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';
        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, pdf_subject, email_content );

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: pdf_subject,
              },
              textHtml: email_content,
              textPlain: pdf_content,
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
              .then(() => {
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: true,
                });
              })
              .catch((err) => {
                console.log('err', err);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: false,
                  err,
                  contact: contacts[i],
                });
              });
          } catch (err) {
            console.log('email send err', err.message || err.msg);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: false,
              err,
              contact: contacts[i],
            });
          }
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            err: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'outlook') {
    let promise;

    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });

    for (let i = 0; i < contacts.length; i++) {
      let accessToken;
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
        .catch((err) => {
          console.log('outlook token grant error', err.message);
          promise_array.push(
            new Promise((resolve, reject) => {
              resolve({
                status: false,
                err: err.message || err.msg,
              });
            })
          );
        });

      if (promise_array.length > 0) {
        return Promise.all(promise_array);
      }

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

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
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      let pdf_titles = '';
      let pdf_descriptions = '';
      let pdf_objects = '';
      let pdf_subject = subject;
      let pdf_content = content;
      let activity;
      for (let j = 0; j < pdfs.length; j++) {
        const pdf = pdfs[j];

        if (typeof pdf_content === 'undefined') {
          pdf_content = '';
        }

        pdf_subject = pdf_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        pdf_content = pdf_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: pdf_subject,
          description: pdf_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('activity save err', err.message);
          });

        const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.PDF_TITLE;
        } else {
          pdf_titles = `${pdf.title}`;
        }

        if (j < pdfs.length - 1) {
          pdf_descriptions += `${pdf.description}, `;
        } else {
          pdf_descriptions += pdf.description;
        }

        // const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/>${pdf.description}<br/><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`
        const pdf_object = `<p style="max-width:800px;margin-top:0px;"><b>${pdf.title}:</b><br/><a href="${pdf_link}"><img src="${pdf.preview}-resize"/></a><br/></p>`;
        pdf_objects += pdf_object;
      }

      if (pdf_subject === '') {
        pdf_subject = 'PDF: ' + pdf_titles;
      } else {
        pdf_subject = pdf_subject.replace(/{pdf_title}/gi, pdf_titles);
        pdf_subject = pdf_subject.replace(/{material_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_object}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
      } else {
        pdf_content = pdf_content + '<br/>' + pdf_objects;
      }

      if (pdf_content.search(/{pdf_title}/gi) !== -1) {
        pdf_content = pdf_content.replace(/{pdf_title}/gi, pdf_titles);
      }

      if (pdf_content.search(/{pdf_description}/gi) !== -1) {
        pdf_content = pdf_content.replace(
          /{pdf_description}/gi,
          pdf_descriptions
        );
      }

      const sendMail = {
        message: {
          subject: pdf_subject,
          body: {
            contentType: 'HTML',
            content:
              '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
              pdf_content +
              '<br/>Thank you,<br/>' +
              currentUser.email_signature +
              generateUnsubscribeLink(activity.id) +
              '</body></html>',
          },
          toRecipients: [
            {
              emailAddress: {
                address: _contact.email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(() => {
            Contact.updateOne(
              { _id: contacts[i] },
              { $set: { last_activity: activity.id } }
            ).catch((err) => {
              console.log('contact update err', err.message);
            });
            resolve({
              status: true,
            });
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            console.log('email send err', err.message || err.msg);
            resolve({
              status: false,
              contact: contacts[i],
              err,
            });
          });
      });
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  }
};

const bulkImage = async (data) => {
  const { user, content, subject, images, contacts } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('current user found err', err.message);
    }
  );

  const promise_array = [];

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          err: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent image using email';
  detail_content = Activity.automationLog(detail_content);

  if (!currentUser.primary_connected) {
    let promise;
    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact not found email',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_subject = subject;
      let image_content = content;
      let activity;
      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_subject = image_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: image_subject,
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = `${image.title}`;
        }

        if (j < images.length - 1) {
          image_descriptions += `${image.description}, `;
        } else {
          image_descriptions += image.description;
        }
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`
        const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`;
        image_objects += image_object;
      }

      if (subject === '') {
        image_subject = 'Image: ' + image_titles;
      } else {
        image_subject = image_subject.replace(/{image_title}/gi, image_titles);
        image_subject = image_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '<br/>' + image_objects;
      }

      if (image_content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (image_content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      const msg = {
        to: _contact.email,
        from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
        replyTo: currentUser.connected_email,
        subject: image_subject,
        html:
          '<html><head><title>Image Invitation</title></head><body><p style="white-space:pre-wrap;max-width:800px;margin-top:0px;">' +
          image_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>',
      };

      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      promise = new Promise((resolve, reject) => {
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              console.log('status', _res[0].statusCode);
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });
              resolve({
                status: true,
              });
            } else {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('activity found err', err.message);
              });
              console.log('email sending err', msg.to + _res[0].statusCode);
              resolve({
                status: false,
                err: _res[0].statusCode,
                contact: contacts[i],
              });
            }
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity found err', err.message);
            });
            console.error('email sending err', err.message);
            resolve({
              status: false,
              err: err.message,
              contact: contacts[i],
            });
          });
      });

      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'outlook') {
    let promise;
    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;
    await new Promise((resolve, reject) => {
      token.refresh((error, result) => {
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
      .catch((err) => {
        console.log('outlook token grant error', err.message);
        promise_array.push(
          new Promise((resolve, reject) => {
            resolve({
              status: false,
              err: err.message,
            });
          })
        );
      });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }
      let image_titles = '';
      let image_descriptions = '';
      let image_objects = '';
      let image_subject = subject;
      let image_content = content;
      let activity;
      for (let j = 0; j < images.length; j++) {
        const image = images[j];

        if (!image_content) {
          image_content = '';
        }

        image_subject = image_subject
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        image_content = image_content
          .replace(/{user_name}/gi, currentUser.user_name)
          .replace(/{user_email}/gi, currentUser.connected_email)
          .replace(/{user_phone}/gi, currentUser.cell_phone)
          .replace(/{contact_first_name}/gi, _contact.first_name)
          .replace(/{contact_last_name}/gi, _contact.last_name)
          .replace(/{contact_email}/gi, _contact.email)
          .replace(/{contact_phone}/gi, _contact.cell_phone);

        const _activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'images',
          images: image._id,
          created_at: new Date(),
          updated_at: new Date(),
          subject: image_subject,
          description: image_content,
        });

        activity = await _activity
          .save()
          .then()
          .catch((err) => {
            console.log('err', err);
          });

        const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = `${image.title}`;
        }

        if (j < images.length - 1) {
          image_descriptions += `${image.description}, `;
        } else {
          image_descriptions += image.description;
        }
        // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`
        const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`;
        image_objects += image_object;
      }

      if (image_subject === '') {
        image_subject = 'Image: ' + image_subject;
      } else {
        image_subject = image_subject.replace(/{image_title}/gi, image_titles);
        image_subject = image_subject.replace(
          /{material_title}/gi,
          image_titles
        );
      }

      if (image_content.search(/{image_object}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_object}/gi,
          image_objects
        );
      } else {
        image_content = image_content + '<br/>' + image_objects;
      }

      if (image_content.search(/{image_title}/gi) !== -1) {
        image_content = image_content.replace(/{image_title}/gi, image_titles);
      }

      if (image_content.search(/{image_description}/gi) !== -1) {
        image_content = image_content.replace(
          /{image_description}/gi,
          image_descriptions
        );
      }

      const sendMail = {
        message: {
          subject: image_subject,
          body: {
            contentType: 'HTML',
            content:
              '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
              image_content +
              '<br/>Thank you,<br/>' +
              currentUser.email_signature +
              generateUnsubscribeLink(activity.id) +
              '</body></html>',
          },
          toRecipients: [
            {
              emailAddress: {
                address: _contact.email,
              },
            },
          ],
        },
        saveToSentItems: 'true',
      };

      promise = new Promise((resolve, reject) => {
        client
          .api('/me/sendMail')
          .post(sendMail)
          .then(() => {
            Contact.updateOne(
              { _id: contacts[i] },
              { $set: { last_activity: activity.id } }
            ).catch((err) => {
              console.log('contact update err', err.message);
              resolve({
                status: true,
              });
            });
          })
          .catch((err) => {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity not found err', err.message);
            });
            console.log('activity found err', err.message);
            resolve({
              status: false,
              err: err.message,
              contact: contacts[i],
            });
          });
      });

      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'gmail') {
    let promise;
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let image_titles = '';
        let image_descriptions = '';
        let image_objects = '';
        let image_subject = subject;
        let image_content = content;
        let activity;
        for (let j = 0; j < images.length; j++) {
          const image = images[j];

          if (!image_content) {
            image_content = '';
          }

          image_subject = image_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          image_content = image_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'images',
            images: image._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: image_subject,
            description: image_content,
          });

          activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

          if (images.length >= 2) {
            image_titles = mail_contents.IMAGE_TITLE;
          } else {
            image_titles = `${image.title}`;
          }

          if (j < images.length - 1) {
            image_descriptions += `${image.description}, `;
          } else {
            image_descriptions += image.description;
          }
          // const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`
          const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/><br/><a href="${image_link}"><img src="${image.preview}-resize"/></a><br/></p>`;
          image_objects += image_object;
        }

        if (image_subject === '') {
          image_subject = 'Image: ' + image_titles;
        } else {
          image_subject = image_subject.replace(
            /{image_title}/gi,
            image_titles
          );
          image_subject = image_subject.replace(
            /{material_title}/gi,
            image_titles
          );
        }

        if (image_content.search(/{image_object}/gi) !== -1) {
          image_content = image_content.replace(
            /{image_object}/gi,
            image_objects
          );
        } else {
          image_content = image_content + '<br/>' + image_objects;
        }

        if (content.search(/{image_title}/gi) !== -1) {
          image_content = image_content.replace(
            /{image_title}/gi,
            image_titles
          );
        }

        if (content.search(/{image_description}/gi) !== -1) {
          image_content = image_content.replace(
            /{image_description}/gi,
            image_descriptions
          );
        }

        const email_content =
          '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
          image_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';
        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, image_subject, email_content );

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: image_subject,
              },
              textHtml: email_content,
              textPlain: image_content,
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
              .then(() => {
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: true,
                });
              })
              .catch((err) => {
                console.log('gmail send err', err);
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('err', err);
                });
                resolve({
                  status: false,
                  err,
                  contact: contacts[i],
                });
              });
          } catch (err) {
            console.log('err', err);
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              status: false,
              err,
              contact: contacts[i],
            });
          }
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            err: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }

    return Promise.all(promise_array);
  }
};

const resendVideo = async (data) => {
  const { user, content, subject, activities, videos, contacts } = data;
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );
  const promise_array = [];

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          err: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'resent video using email';
  detail_content = ActivityHelper.autoSettingLog(detail_content);

  if (!currentUser.primary_connected) {
    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email removed',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_subject = subject;
        let video_content = content;
        let video_titles = '';
        let video_objects = '';
        let activity;

        for (let j = 0; j < activities.length; j++) {
          activity = activities[j];
          const video = await Video.findOne({ _id: videos[j] });
          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'];
          }

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
          video_subject = video_subject.replace(
            /{material_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        const msg = {
          to: _contact.email,
          from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
          replyTo: currentUser.connected_email,
          subject: video_subject,
          html:
            '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
            video_content +
            '<br/>Thank you,<br/>' +
            currentUser.email_signature +
            generateUnsubscribeLink(activity) +
            '</body></html>',
          text: video_content,
        };

        promise = new Promise((resolve, reject) => {
          sgMail
            .send(msg)
            .then(async (_res) => {
              console.log('mailres.errorcode', _res[0].statusCode);
              if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
                console.log('status', _res[0].statusCode);

                const _activity = new Activity({
                  content: detail_content,
                  contacts: contacts[i],
                  user: currentUser.id,
                  type: 'videos',
                  videos: videos[0],
                  subject: video_subject,
                  description: video_content,
                });

                const resend_activity = await _activity
                  .save()
                  .then()
                  .catch((err) => {
                    console.log('resend activity err', err.message);
                  });
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: resend_activity.id } }
                ).catch((err) => {
                  console.log('conatct update err', err.message);
                });
                resolve({
                  status: true,
                });
              } else {
                resolve({
                  status: false,
                  err: msg.to + _res[0].statusCode,
                  contact: contacts[i],
                });
              }
            })
            .catch((err) => {
              console.log('email sending err', msg.to);
              console.error(err);
              resolve({
                status: false,
                err,
                contact: contacts[i],
              });
            });
        });
        promise_array.push(promise);
      }
    }

    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'gmail') {
    const promise_array = [];
    let promise;

    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );
    const token = JSON.parse(currentUser.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: token.refresh_token });
    await oauth2Client.getAccessToken().catch((err) => {
      console.log('get access err', err.message || err.msg);
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            err,
          });
        })
      );
    });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise((resolve, reject) => {
            resolve({
              contact: {
                id: contacts[i],
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < activities.length; j++) {
          activity = activities[j];
          const video = await Video.findOne({ _id: videos[j] });
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'] + '-resize';
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
          video_subject = video_subject.replace(
            /{material_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const email_content =
          '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
          video_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity) +
          '</body></html>';

        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, video_subject, email_content );

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: video_subject,
              },
              textHtml: email_content,
              textPlain: video_content,
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
                const _activity = new Activity({
                  content: detail_content,
                  contacts: contacts[i],
                  user: currentUser.id,
                  type: 'videos',
                  videos: videos[0],
                  created_at: new Date(),
                  updated_at: new Date(),
                  subject: video_subject,
                  description: video_content,
                });

                const resend_activity = await _activity
                  .save()
                  .then()
                  .catch((err) => {
                    console.log('resend activity err', err.message);
                  });
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: resend_activity.id } }
                ).catch((err) => {
                  console.log('contact find err', err.message);
                });
                resolve({
                  status: true,
                });
              })
              .catch((err) => {
                console.log('err', err.message);
                resolve({
                  status: false,
                  err,
                  contact: contacts[i],
                });
              });
          } catch (err) {
            console.log('err', err.message);
            resolve({
              status: false,
              err: err.message,
              contact: contacts[i],
            });
          }
        });
      } else {
        promise = new Promise((resolve, reject) => {
          resolve({
            status: false,
            err: 'no contact found',
            contact: contacts[i],
          });
        });
      }
      promise_array.push(promise);
    }
    return Promise.all(promise_array);
  } else if (currentUser.connected_email_type === 'outlook') {
    const promise_array = [];
    let promise;

    const token = oauth2.accessToken.create({
      refresh_token: currentUser.outlook_refresh_token,
      expires_in: 0,
    });
    let accessToken;
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
      .catch((err) => {
        console.log('outlook token grant error', err.message || err.msg);
        promise_array.push(
          new Promise((resolve, reject) => {
            resolve({
              status: false,
              err: err.message || err.msg,
            });
          })
        );
      });

    if (promise_array.length > 0) {
      return Promise.all(promise_array);
    }

    const client = graph.Client.init({
      // Use the provided access token to authenticate
      // requests
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    for (let i = 0; i < contacts.length; i++) {
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
        if (_contact) {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email unsubscribed',
            });
          });
          promise_array.push(promise);
          continue;
        } else {
          promise = new Promise(async (resolve, reject) => {
            resolve({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: 'contact email not found',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (_contact) {
        let video_titles = '';
        let video_descriptions = '';
        let video_objects = '';
        let video_subject = subject;
        let video_content = content;
        let activity;
        for (let j = 0; j < activities.length; j++) {
          activity = activities[j];
          const video = await Video.findOne({ _id: videos[j] });
          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'] + '-resize';
          }

          if (typeof video_content === 'undefined') {
            video_content = '';
          }

          video_subject = video_subject
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          video_content = video_content
            .replace(/{user_name}/gi, currentUser.user_name)
            .replace(/{user_email}/gi, currentUser.connected_email)
            .replace(/{user_phone}/gi, currentUser.cell_phone)
            .replace(/{contact_first_name}/gi, _contact.first_name)
            .replace(/{contact_last_name}/gi, _contact.last_name)
            .replace(/{contact_email}/gi, _contact.email)
            .replace(/{contact_phone}/gi, _contact.cell_phone);

          if (videos.length >= 2) {
            video_titles = mail_contents.VIDEO_TITLE;
          } else {
            video_titles = `${video.title}`;
          }

          if (j < videos.length - 1) {
            video_descriptions += `${video.description}, `;
          } else {
            video_descriptions += video.description;
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity;
          // const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`;
          video_objects += video_object;
        }

        if (video_subject === '') {
          video_subject = 'VIDEO: ' + video_titles;
        } else {
          video_subject = video_subject.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_object}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_object}/gi,
            video_objects
          );
        } else {
          video_content = video_content + '<br/>' + video_objects;
        }

        if (video_content.search(/{video_title}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_title}/gi,
            video_titles
          );
        }

        if (video_content.search(/{video_description}/gi) !== -1) {
          video_content = video_content.replace(
            /{video_description}/gi,
            video_descriptions
          );
        }

        const sendMail = {
          message: {
            subject: video_subject,
            body: {
              contentType: 'HTML',
              content:
                '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
                video_content +
                '<br/>Thank you,<br/>' +
                currentUser.email_signature +
                generateUnsubscribeLink(activity) +
                '</body></html>',
            },
            toRecipients: [
              {
                emailAddress: {
                  address: _contact.email,
                },
              },
            ],
          },
          saveToSentItems: 'true',
        };

        promise = new Promise((resolve, reject) => {
          client
            .api('/me/sendMail')
            .post(sendMail)
            .then(async () => {
              const _activity = new Activity({
                content: detail_content,
                contacts: contacts[i],
                user: currentUser.id,
                type: 'videos',
                videos: videos[0],
                created_at: new Date(),
                updated_at: new Date(),
                subject: video_subject,
                description: video_content,
              });

              const resend_activity = await _activity
                .save()
                .then()
                .catch((err) => {
                  console.log('resend activity err', err.message);
                });
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: resend_activity.id },
                }
              ).catch((err) => {
                console.log('err', err.message);
              });
              resolve({
                status: true,
              });
            })
            .catch((err) => {
              console.log('outlook send err', err.message);
              resolve({
                status: false,
                contact: contacts[i],
                err: err.message,
              });
            });
        });
        promise_array.push(promise);
      }
    }

    return Promise.all(promise_array);
  }
};

const addLinkTracking = (content, activity) => {
  const $ = cheerio.load(content);
  $('a[href]').each((index, elem) => {
    const url = $(elem).attr('href');
    const attached_link =
      urls.CLICK_REDIRECT_URL + `?url=${url}&activity_id=${activity}`;
    $(elem).attr('href', attached_link);
  });
  return $.html();
};

const generateUnsubscribeLink = (id) => {
  return `<p style="color: #222;margin-top: 20px;font-size: 11px;">If you'd like to unsubscribe and stop receiving these emails <a href="${urls.UNSUBSCRIPTION_URL}?activity=${id}" style="color: #222;"> Unsubscribe.</a></p>`;
  // <p style="color: #222;margin-top: 20px;font-size: 11px;">Or If you'd like to resubscribe receiving these emails <a href="${urls.RESUBSCRIPTION_URL}${id}" style="color: #222;"> Resubscribe.</a></p>`;
};

const generateOpenTrackLink = (id) => {
  return `<img src='${urls.TRACK_URL}${id}'/>`;
};

module.exports = {
  isBlockedEmail,
  bulkEmail,
  bulkVideo,
  bulkPDF,
  bulkImage,
  resendVideo,
  addLinkTracking,
  generateUnsubscribeLink,
  generateOpenTrackLink,
};
