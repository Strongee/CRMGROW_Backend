const phone = require('phone');
const moment = require('moment-timezone');
const fs = require('fs');
const AWS = require('aws-sdk');

const User = require('../models/user');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Folder = require('../models/folder');
const Team = require('../models/team');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const Text = require('../models/text');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const Notification = require('../models/notification');
const Garbage = require('../models/garbage');
const Task = require('../models/task');
const ActivityHelper = require('../helpers/activity');
const api = require('../config/api');
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const { google } = require('googleapis');
const graph = require('@microsoft/microsoft-graph-client');
const {
  generateUnsubscribeLink,
  generateOpenTrackLink,
  addLinkTracking,
} = require('../helpers/email');
const {
  sleep,
  generateUnsubscribeLink: generateTextUnsubscribeLink,
} = require('../helpers/text');
const garbageHelper = require('../helpers/garbage.js');
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const TimeLine = require('../models/time_line');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};

const oauth2 = require('simple-oauth2')(credentials);

const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});
const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;

const twilio = require('twilio')(accountSid, authToken);

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const bulkEmail = async (req, res) => {
  const { currentUser } = req;
  const {
    contacts,
    video_ids,
    pdf_ids,
    image_ids,
    content,
    subject,
    cc,
    bcc,
    scheduled_time,
    attachments,
  } = req.body;

  let email_count = currentUser['email_info']['count'] || 0;
  const max_email_count =
    currentUser['email_info']['max_count'] ||
    system_settings.EMAIL_DAILY_LIMIT.BASIC;

  let html_content = '';
  let no_connected = false;
  const promise_array = [];

  if (!currentUser.primary_connected) {
    return res.status(406).json({
      status: false,
      error: 'no connected',
    });
  }

  for (let i = 0; i < contacts.length; i++) {
    let promise;
    const activities = [];

    let contact = await Contact.findOne({
      _id: contacts[i],
      tags: { $nin: ['unsubscribed'] },
    }).catch((err) => {
      console.log('contact found err', err.message);
    });

    if (!contact) {
      contact = await Contact.findOne({ _id: contacts[i] }).catch((err) => {
        console.log('contact found err', err.message);
      });
      if (contact) {
        promise = new Promise(async (resolve, reject) => {
          resolve({
            status: false,
            contact: {
              id: contacts[i],
              first_name: contact.first_name,
              email: contact.email,
            },
            error: 'contact email unsubscribed',
          });
        });
        promise_array.push(promise);
        continue;
      } else {
        promise = new Promise(async (resolve, reject) => {
          resolve({
            status: false,
            contact: {
              id: contacts[i],
              first_name: contact.first_name,
              email: contact.email,
            },
            error: 'contact email removed',
          });
        });
        promise_array.push(promise);
        continue;
      }
    }

    if (scheduled_time) {
      const task = new Task({
        user: currentUser.id,
        action: {
          type: 'send_email_video',
          video_ids,
          pdf_ids,
          image_ids,
          content,
          subject,
          cc,
          bcc,
        },
        contact: contacts[i],
        due_date: scheduled_time,
        status: 'pending',
      });

      task.save().catch((err) => {
        console.log('material send email timeline save err', err.message);
      });
      continue;
    }

    const email_info = currentUser['email_info'];
    if (email_info['is_limit'] && email_count > max_email_count) {
      promise = new Promise((resolve, reject) => {
        resolve({
          status: false,
          contact: {
            first_name: contact.first_name,
            email: contact.email,
          },
          error: 'email daily limit exceed!',
        });
      });
      promise_array.push(promise);
      continue;
    }

    if (contact) {
      let email_subject = subject;
      let email_content = content;
      let material_title;

      if (!email_content) {
        email_content = '';
      }

      email_subject = email_subject
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.connected_email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, contact.first_name)
        .replace(/{contact_last_name}/gi, contact.last_name)
        .replace(/{contact_email}/gi, contact.email)
        .replace(/{contact_phone}/gi, contact.cell_phone);

      email_content = email_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.connected_email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, contact.first_name)
        .replace(/{contact_last_name}/gi, contact.last_name)
        .replace(/{contact_email}/gi, contact.email)
        .replace(/{contact_phone}/gi, contact.cell_phone);

      if (
        (video_ids && pdf_ids) ||
        (video_ids && image_ids) ||
        (pdf_ids && image_ids)
      ) {
        material_title = mail_contents.MATERIAL_TITLE;
        email_subject = email_subject.replace(
          /{material_title}/gi,
          material_title
        );
      }

      if (video_ids && video_ids.length > 0) {
        let video_titles = '';
        const video_objects = '';
        const videos = await Video.find({ _id: { $in: video_ids } }).catch(
          (err) => {
            console.log('video find error', err.message);
          }
        );

        let activity_content = 'sent video using email';
        if (req.guest_loggin) {
          activity_content = ActivityHelper.assistantLog(activity_content);
        }

        if (videos.length >= 2) {
          video_titles = mail_contents.VIDEO_TITLE;
        } else {
          video_titles = videos[0].title;
        }

        if (!material_title) {
          email_subject = email_subject.replace(
            /{material_title}/gi,
            video_titles
          );
        }

        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];

          const activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video.id,
            subject: video.title,
          });

          let preview;
          if (video['preview']) {
            preview = video['preview'];
          } else {
            preview = video['thumbnail'];
          }

          activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const html_preview = `<a href="${video_link}"><img src="${preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a>`;
          email_content = email_content.replace(
            new RegExp(`{{${video.id}}}`, 'g'),
            video_link
          );

          // const video_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          // video_objects += video_object;
          activities.push(activity.id);
        }
        // email_content = email_content + '<br/>' + video_objects;
      }

      if (pdf_ids && pdf_ids.length > 0) {
        let pdf_titles = '';
        const pdf_objects = '';
        const pdfs = await PDF.find({ _id: { $in: pdf_ids } }).catch((err) => {
          console.log('pdf find error', err.message);
        });

        let activity_content = 'sent pdf using email';
        if (req.guest_loggin) {
          activity_content = ActivityHelper.assistantLog(activity_content);
        }

        if (pdfs.length >= 2) {
          pdf_titles = mail_contents.VIDEO_TITLE;
        } else {
          pdf_titles = pdfs[0].title;
        }

        if (!material_title) {
          email_subject = email_subject.replace(
            /{material_title}/gi,
            pdf_titles
          );
        }
        for (let j = 0; j < pdfs.length; j++) {
          const pdf = pdfs[j];
          const activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'pdfs',
            pdfs: pdf.id,
            subject: email_subject,
          });

          activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
          // const html_preview = `<a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a>`;
          email_content = email_content.replace(
            new RegExp(`{{${pdf.id}}}`, 'g'),
            pdf_link
          );

          // const pdf_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          // pdf_objects += pdf_object;
          activities.push(activity.id);
        }
        // email_content = email_content + '<br/>' + pdf_objects;
      }

      if (image_ids && image_ids.length > 0) {
        let image_titles = '';
        const image_objects = '';
        const images = await Image.find({ _id: { $in: image_ids } }).catch(
          (err) => {
            console.log('image find error', err.message);
          }
        );

        let activity_content = 'sent image using email';
        if (req.guest_loggin) {
          activity_content = ActivityHelper.assistantLog(activity_content);
        }

        if (images.length >= 2) {
          image_titles = mail_contents.IMAGE_TITLE;
        } else {
          image_titles = images[0].title;
        }

        if (!material_title) {
          email_subject = email_subject.replace(
            /{material_title}/gi,
            image_titles
          );
        }
        for (let j = 0; j < images.length; j++) {
          const image = images[j];
          const activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'images',
            images: image.id,
            subject: email_subject,
          });

          activity.save().catch((err) => {
            console.log('activity image err', err.message);
          });

          const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;
          // const html_preview = `<a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a>`;
          email_content = email_content.replace(
            new RegExp(`{{${image.id}}}`, 'g'),
            image_link
          );

          // const image_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          // image_objects += image_object;
          activities.push(activity.id);
        }
        // email_content = email_content + '<br/>' + image_objects;
      }

      let activity_content = 'sent email';
      if (req.guest_loggin) {
        activity_content = ActivityHelper.assistantLog(activity_content);
      }

      const email = new Email({
        user: currentUser.id,
        subject: email_subject,
        content: email_content,
        cc,
        bcc,
        contacts: contacts[i],
      });

      email.save().catch((err) => {
        console.log('email save err', err.message);
      });

      const activity = new Activity({
        content: activity_content,
        contacts: contacts[i],
        user: currentUser.id,
        type: 'emails',
        subject: email_subject,
        emails: email.id,
        videos: video_ids,
        pdfs: pdf_ids,
        images: image_ids,
      });

      activity.save().catch((err) => {
        console.log('email send err', err.message);
      });

      if (cc.length > 0 || bcc.length > 0) {
        html_content =
          '<html><head><title>Email</title></head><body><tbody><tr><td>' +
          email_content +
          '</td></tr><tr><td>' +
          currentUser.email_signature +
          '</td></tr><tr><td>' +
          generateUnsubscribeLink(activity.id) +
          '</td></tr></tbody></body></html>';
      } else {
        email_content = addLinkTracking(email_content, activity.id);
        html_content =
          '<html><head><title>Email</title></head><body><tbody><tr><td>' +
          email_content +
          '</td></tr><tr><td>' +
          generateOpenTrackLink(activity.id) +
          '</td></tr><tr><td>' +
          currentUser.email_signature +
          '</td></tr><tr><td>' +
          generateUnsubscribeLink(activity.id) +
          '</td></tr></tbody></body></html>';
      }

      if (video_ids || pdf_ids || image_ids) {
        const garbage = await Garbage.findOne({
          user: currentUser.id,
        }).catch((err) => {
          console.log('garbage find err', err.message);
        });

        if (garbage && garbage.auto_follow_up2) {
          const auto_follow_up2 = garbage.auto_follow_up2;
          if (auto_follow_up2['enabled']) {
            const now = moment();
            const period = auto_follow_up2['period'];
            const content = auto_follow_up2['content'];
            const due_date = now.add(period, 'hours');

            if (video_ids && video_ids.length > 0) {
              for (let j = 0; j < video_ids.length; j++) {
                const task = new Task({
                  user: currentUser.id,
                  action: {
                    type: 'auto_follow_up2',
                    due_date,
                    content,
                  },
                  watched_video: video_ids[j],
                  'condition.case': 'watched_video',
                  'condition.answer': false,
                  status: 'active',
                  contact: contacts[i],
                });

                task.save().catch((err) => {
                  console.log('task save err', err.message);
                });
              }
            }

            if (pdf_ids && pdf_ids.length > 0) {
              for (let j = 0; j < pdf_ids.length; j++) {
                const task = new Task({
                  user: currentUser.id,
                  action: {
                    type: 'auto_follow_up2',
                    due_date,
                    content,
                  },
                  watched_pdf: pdf_ids[j],
                  'condition.case': 'watched_pdf',
                  'condition.answer': false,
                  status: 'active',
                  contact: contacts[i],
                });

                task.save().catch((err) => {
                  console.log('task save err', err.message);
                });
              }
            }

            if (image_ids && image_ids.length > 0) {
              for (let j = 0; j < image_ids.length; j++) {
                const task = new Task({
                  user: currentUser.id,
                  action: {
                    type: 'auto_follow_up2',
                    due_date,
                    content,
                  },
                  watched_image: image_ids[j],
                  'condition.case': 'watched_image',
                  'condition.answer': false,
                  status: 'active',
                  contact: contacts[i],
                });

                task.save().catch((err) => {
                  console.log('task save err', err.message);
                });
              }
            }
          }
        }
      }

      if (
        currentUser.connected_email_type === 'gmail' ||
        currentUser.connected_email_type === 'gsuit'
      ) {
        const oauth2Client = new google.auth.OAuth2(
          api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
          api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
          urls.GMAIL_AUTHORIZE_URL
        );

        const token = JSON.parse(currentUser.google_refresh_token);
        oauth2Client.setCredentials({ refresh_token: token.refresh_token });

        await oauth2Client.getAccessToken().catch((err) => {
          console.log('get access err', err.message);
        });

        if (!oauth2Client.credentials.access_token) {
          promise_array.push(
            new Promise((resolve, reject) => {
              resolve({
                status: false,
                contact: {
                  first_name: contact.first_name,
                  email: contact.email,
                },
                error: 'google access token invalid!',
              });
            })
          );
          continue;
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

        promise = new Promise((resolve, reject) => {
          try {
            const body = createBody({
              headers: {
                To: contact.email,
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
                Activity.updateMany(
                  { _id: { $in: activities } },
                  {
                    $set: { emails: email.id },
                  }
                ).catch((err) => {
                  console.log('activity update err', err.message);
                });

                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err.message);
                });

                resolve({
                  status: true,
                  data: activities,
                });
              })
              .catch((err) => {
                Activity.deleteOne({ _id: activity.id }).catch((err) => {
                  console.log('activity delete err', err.message);
                });

                Activity.deleteMany({ _id: { $in: activities } }).catch(
                  (err) => {
                    console.log('activity delete err', err.message);
                  }
                );
                if (err.statusCode === 403) {
                  no_connected = true;
                  resolve({
                    status: false,
                    contact: {
                      first_name: contact.first_name,
                      email: contact.email,
                    },
                    error: 'No Connected Gmail',
                  });
                } else if (err.statusCode === 400) {
                  resolve({
                    status: false,
                    contact: {
                      first_name: contact.first_name,
                      email: contact.email,
                    },
                    error: err.message,
                  });
                } else {
                  console.log('recipience err', err);
                  resolve({
                    status: false,
                    contact: {
                      first_name: contact.first_name,
                      email: contact.email,
                    },
                    error: 'Recipient address required',
                  });
                }
              });
          } catch (err) {
            console.log('gmail video send err', err.message);

            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('activity delete err', err.message);
            });

            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('activieis delete err', err.message);
            });
            resolve({
              status: false,
              contact: {
                first_name: contact.first_name,
                email: contact.email,
              },
              error: err.message,
            });
          }
        });
        promise_array.push(promise);
      } else if (
        currentUser.connected_email_type === 'outlook' ||
        currentUser.connected_email_type === 'microsoft'
      ) {
        const token = oauth2.accessToken.create({
          refresh_token: currentUser.outlook_refresh_token,
          expires_in: 0,
        });

        let accessToken;

        await new Promise((resolve, reject) => {
          token.refresh(function (error, result) {
            if (error) {
              reject(error);
            } else {
              resolve(result.token);
            }
          });
        })
          .then((token) => {
            accessToken = token.access_token;
          })
          .catch((error) => {
            console.log('error', error);
            return res.status(406).send({
              status: false,
              error: 'not connected',
            });
          });

        const client = graph.Client.init({
          authProvider: (done) => {
            done(null, accessToken);
          },
        });

        const attachment_array = [];
        const cc_array = [];
        const bcc_array = [];

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

        if (cc) {
          for (let i = 0; i < cc.length; i++) {
            cc_array.push({
              emailAddress: {
                address: cc[i],
              },
            });
          }
        }

        if (bcc) {
          for (let i = 0; i < bcc.length; i++) {
            bcc_array.push({
              emailAddress: {
                address: bcc[i],
              },
            });
          }
        }

        const sendMail = {
          message: {
            subject: email_subject,
            body: {
              contentType: 'HTML',
              content: email_content,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: contact.email,
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
            .then(async () => {
              email_count += 1;
              Contact.updateOne(
                { _id: contacts[i] },
                {
                  $set: { last_activity: activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });

              Activity.updateMany(
                { _id: { $in: activities } },
                {
                  $set: { emails: email.id },
                }
              ).catch((err) => {
                console.log('activity update err', err.message);
              });

              resolve({
                status: true,
                data: activities,
              });
            })
            .catch((err) => {
              Activity.deleteOne({ _id: activity.id }).catch((err) => {
                console.log('activity delete err', err.message);
              });

              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('error', err.message);
              });
              console.log('microsoft email send error', err.message);
              resolve({
                status: false,
                contact: {
                  id: contact.id,
                  first_name: contact.first_name,
                  email: contact.email,
                },
                error: err.message || err.msg,
              });
            });
        });
        promise_array.push(promise);
      }
    }
  }
  Promise.all(promise_array)
    .then((result) => {
      const error = [];
      result.forEach((_res) => {
        if (!_res.status) {
          error.push({
            contact: _res.contact,
            error: _res.error,
          });
        }
      });

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
      return res.status(500).json({
        status: false,
        error: err,
      });
    });
};

const bulkText = async (req, res) => {
  const { currentUser } = req;
  const { video_ids, pdf_ids, image_ids, content, contacts, mode } = req.body;

  const promise_array = [];
  const error = [];
  if (contacts) {
    if (contacts.length > system_settings.TEXT_ONE_TIME) {
      return res.status(400).json({
        status: false,
        error: `You can send max ${system_settings.TEXT_ONE_TIME} contacts at a time`,
      });
    }

    if (!currentUser['proxy_number'] && !currentUser['twilio_number']) {
      return res.status(407).json({
        status: false,
        error: 'No phone',
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      if (i > 0) {
        await sleep(1000);
      }

      let text_content = content;
      const activities = [];

      const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
        (err) => {
          console.log('contact update err', err.messgae);
        }
      );

      text_content = text_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.connected_email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, _contact.first_name)
        .replace(/{contact_last_name}/gi, _contact.last_name)
        .replace(/{contact_email}/gi, _contact.email)
        .replace(/{contact_phone}/gi, _contact.cell_phone);

      if (video_ids && video_ids.length > 0) {
        let activity_content = 'sent video using sms';

        switch (mode) {
          case 'automation':
            activity_content = ActivityHelper.automationLog(activity_content);
            break;
          case 'campaign':
            activity_content = ActivityHelper.campaignLog(activity_content);
            break;
          case 'api':
            activity_content = ActivityHelper.apiLog(activity_content);
            break;
        }

        for (let j = 0; j < video_ids.length; j++) {
          const video = await Video.findOne({ _id: video_ids[j] }).catch(
            (err) => {
              console.log('video find error', err.message);
            }
          );

          const activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video.id,
          });

          activity.save().catch((err) => {
            console.log('email send err', err.message);
          });

          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          text_content = text_content.replace(
            new RegExp(`{{${video.id}}}`, 'g'),
            video_link
          );

          activities.push(activity.id);
        }
      }

      if (pdf_ids && pdf_ids.length > 0) {
        let activity_content = 'sent pdf using sms';

        switch (mode) {
          case 'automation':
            activity_content = ActivityHelper.automationLog(activity_content);
            break;
          case 'campaign':
            activity_content = ActivityHelper.campaignLog(activity_content);
            break;
          case 'api':
            activity_content = ActivityHelper.apiLog(activity_content);
            break;
        }

        for (let j = 0; j < pdf_ids.length; j++) {
          const pdf = await PDF.findOne({ _id: pdf_ids[j] }).catch((err) => {
            console.log('pdf find error', err.message);
          });

          const activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'pdfs',
            pdfs: pdf.id,
          });

          activity.save().catch((err) => {
            console.log('email send err', err.message);
          });

          const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
          text_content = text_content.replace(
            new RegExp(`{{${pdf.id}}}`, 'g'),
            pdf_link
          );

          activities.push(activity.id);
        }
      }

      if (image_ids && image_ids.length > 0) {
        let activity_content = 'sent image using email';

        switch (mode) {
          case 'automation':
            activity_content = ActivityHelper.automationLog(activity_content);
            break;
          case 'campaign':
            activity_content = ActivityHelper.campaignLog(activity_content);
            break;
          case 'api':
            activity_content = ActivityHelper.apiLog(activity_content);
            break;
        }

        for (let j = 0; j < image_ids.length; j++) {
          const image = await Image.findOne({ _id: image_ids[j] }).catch(
            (err) => {
              console.log('image find error', err.message);
            }
          );

          const activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'images',
            images: image.id,
          });

          activity.save().catch((err) => {
            console.log('email send err', err.message);
          });

          const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;
          text_content = text_content.replace(
            new RegExp(`{{${image.id}}}`, 'g'),
            image_link
          );

          activities.push(activity.id);
        }
      }

      let activity_content = 'sent text';

      if (req.guest_loggin) {
        activity_content = ActivityHelper.assistantLog(activity_content);
      }

      const text = new Text({
        user: currentUser.id,
        content: text_content,
        contacts: contacts[i],
        type: 0,
      });

      text.save().catch((err) => {
        console.log('text save err', err.message);
      });

      const activity = new Activity({
        content: activity_content,
        contacts: contacts[i],
        user: currentUser.id,
        type: 'texts',
        texts: text.id,
        videos: video_ids,
        pdfs: pdf_ids,
        images: image_ids,
      });

      activity.save().catch((err) => {
        console.log('text send err', err.message);
      });

      let fromNumber = currentUser['proxy_number'];
      let promise;

      if (fromNumber) {
        promise = new Promise(async (resolve) => {
          const e164Phone = phone(_contact.cell_phone)[0];
          if (!e164Phone) {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              error: 'Invalid phone number',
            });
            resolve(); // Invalid phone number
          }

          client.messages
            .create({
              from: fromNumber,
              to: e164Phone,
              body: text_content + '\n\n' + generateTextUnsubscribeLink(),
            })
            .then((message) => {
              if (message.status === 'queued' || message.status === 'sent') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  text_content
                );

                const now = moment();
                const due_date = now.add(1, 'minutes');
                const timeline = new TimeLine({
                  user: currentUser.id,
                  status: 'active',
                  action: {
                    type: 'bulk_sms',
                    message_sid: message.sid,
                    activities,
                  },
                  due_date,
                });
                timeline.save().catch((err) => {
                  console.log('time line save err', err.message);
                });

                Activity.updateMany(
                  { _id: { $in: activities } },
                  {
                    $set: { status: 'pending' },
                  }
                ).catch((err) => {
                  console.log('activity err', err.message);
                });

                const notification = new Notification({
                  user: currentUser.id,
                  message_sid: message.sid,
                  contact: _contact.id,
                  activities,
                  criteria: 'bulk_sms',
                  status: 'pending',
                });
                notification.save().catch((err) => {
                  console.log('notification save err', err.message);
                });
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  text_content
                );
                Contact.updateOne(
                  { _id: contacts[i] },
                  {
                    $set: { last_activity: activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve();
              } else {
                Activity.deleteMany({ _id: { $in: activities } }).catch(
                  (err) => {
                    console.log('err', err);
                  }
                );
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    cell_phone: _contact.cell_phone,
                  },
                  error: message.error_message,
                });
                resolve();
              }
            })
            .catch((err) => {
              console.log('video message send err', err);
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('err', err);
              });
              error.push({
                contact: {
                  first_name: _contact.first_name,
                  cell_phone: _contact.cell_phone,
                },
                err,
              });
              resolve();
            });
        });
      } else {
        fromNumber = currentUser['twilio_number'];

        promise = new Promise(async (resolve) => {
          const e164Phone = phone(_contact.cell_phone)[0];
          if (!e164Phone) {
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('activity delete err', err.message);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              error: 'Invalid phone number',
            });
            resolve(); // Invalid phone number
          }

          twilio.messages
            .create({
              from: fromNumber,
              body: text_content + '\n\n' + generateTextUnsubscribeLink(),
              to: e164Phone,
            })
            .then((message) => {
              if (
                message.status === 'accepted' ||
                message.status === 'sending' ||
                message.status === 'queued' ||
                message.status === 'sent'
              ) {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  text_content
                );

                const now = moment();
                const due_date = now.add(1, 'minutes');
                const timeline = new TimeLine({
                  user: currentUser.id,
                  status: 'active',
                  action: {
                    type: 'bulk_sms',
                    message_sid: message.sid,
                    activities,
                    service: 'twilio',
                  },
                  due_date,
                });
                timeline.save().catch((err) => {
                  console.log('time line save err', err.message);
                });

                Activity.updateMany(
                  { _id: { $in: activities } },
                  {
                    $set: {
                      status: 'pending',
                      texts: text.id,
                    },
                  }
                ).catch((err) => {
                  console.log('activity err', err.message);
                });

                const notification = new Notification({
                  user: currentUser.id,
                  message_sid: message.sid,
                  contact: _contact.id,
                  activities,
                  criteria: 'bulk_sms',
                  status: 'pending',
                });
                notification.save().catch((err) => {
                  console.log('notification save err', err.message);
                });
                resolve();
              } else if (message.status === 'delivered') {
                console.log('Message ID: ', message.sid);
                console.info(
                  `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                  text_content
                );

                Activity.updateMany(
                  { _id: { $in: activities } },
                  {
                    $set: {
                      texts: text.id,
                    },
                  }
                ).catch((err) => {
                  console.log('activity err', err.message);
                });

                Contact.updateOne(
                  { _id: contacts[i] },
                  {
                    $set: { last_activity: activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
                resolve();
              } else {
                Activity.deleteMany({ _id: { $in: activities } }).catch(
                  (err) => {
                    console.log('err', err);
                  }
                );
                error.push({
                  contact: {
                    first_name: _contact.first_name,
                    cell_phone: _contact.cell_phone,
                  },
                  error: message.error_message,
                });
                resolve();
              }
            })
            .catch((err) => {
              console.log('send sms error: ', err);
            });
        });
      }
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
  } else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found',
    });
  }
};

const socialShare = async (req, res) => {
  const { activity_id, site } = req.body;
  const activity = await Activity.findOne({ _id: activity_id });
  let _activity;

  if (activity) {
    const user = await User.findOne({ _id: activity.user, del: false }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    if (user && contact) {
      const activity_type = activity.type;
      switch (activity_type) {
        case 'videos': {
          const video_tracker = new VideoTracker({
            user: user.id,
            contact: contact.id,
            video: activity.videos,
            type: 'share',
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
            content: `clicked ${site} share button`,
            contacts: contact.id,
            user: user.id,
            type: 'video_trackers',
            videos: activity.videos,
            video_trackers: _video_tracker.id,
          });
          break;
        }
        case 'pdfs': {
          const pdf_tracker = new PDFTracker({
            user: user.id,
            contact: contact.id,
            pdf: activity.pdfs,
            type: 'share',
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
            content: `clicked ${site} share button`,
            contacts: contact.id,
            user: user.id,
            type: 'pdf_trackers',
            pdfs: activity.pdfs,
            pdf_trackers: _pdf_tracker.id,
          });
          break;
        }
        case 'images': {
          const image_tracker = new ImageTracker({
            user: user.id,
            contact: contact.id,
            image: activity.images,
            type: 'share',
            activity: activity.id,
          });

          const _image_tracker = await image_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('image track save error', err.message);
            });

          _activity = new Activity({
            content: `clicked ${site} share button`,
            contacts: contact.id,
            user: user.id,
            type: 'image_trackers',
            images: activity.images,
            image_trackers: _image_tracker.id,
          });
          break;
        }
        default:
          break;
      }

      const last_activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });
      Contact.updateOne(
        { _id: contact.id },
        {
          $set: { last_activity: last_activity.id },
        }
      ).catch((err) => {
        console.log('update contact err', err.message);
      });
    }
  }

  return res.json({
    status: true,
  });
};

const thumbsUp = async (req, res) => {
  const { activity_id } = req.body;
  const activity = await Activity.findOne({ _id: activity_id });
  let _activity;

  if (activity) {
    const user = await User.findOne({ _id: activity.user, del: false }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    const contact = await Contact.findOne({ _id: activity.contacts }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    if (user && contact) {
      const activity_type = activity.type;
      switch (activity_type) {
        case 'videos': {
          const video_tracker = new VideoTracker({
            user: user.id,
            contact: contact.id,
            video: activity.videos,
            type: 'thumbs up',
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
            content: `gave thumbs up`,
            contacts: contact.id,
            user: user.id,
            type: 'video_trackers',
            videos: activity.videos,
            video_trackers: _video_tracker.id,
          });
          break;
        }
        case 'pdfs': {
          const pdf_tracker = new PDFTracker({
            user: user.id,
            contact: contact.id,
            pdf: activity.pdfs,
            type: 'thumbs up',
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
            content: `gave thumbs up`,
            contacts: contact.id,
            user: user.id,
            type: 'pdf_trackers',
            pdfs: activity.pdfs,
            pdf_trackers: _pdf_tracker.id,
          });
          break;
        }
        case 'images': {
          const image_tracker = new ImageTracker({
            user: user.id,
            contact: contact.id,
            image: activity.images,
            type: 'thumbs up',
            activity: activity.id,
          });

          const _image_tracker = await image_tracker
            .save()
            .then()
            .catch((err) => {
              console.log('image track save error', err.message);
            });

          _activity = new Activity({
            content: `gave thumbs up`,
            contacts: contact.id,
            user: user.id,
            type: 'image_trackers',
            images: activity.images,
            image_trackers: _image_tracker.id,
          });
          break;
        }
        default:
          break;
      }

      const last_activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });
      Contact.updateOne(
        { _id: contact.id },
        {
          $set: { last_activity: last_activity.id },
        }
      ).catch((err) => {
        console.log('update contact err', err.message);
      });
    }
  }

  return res.json({
    status: true,
  });
};

const loadMaterial = async (req, res) => {
  const { currentUser } = req;
  const garbage = await garbageHelper.get(currentUser);
  let editedVideos = [];
  let editedPdfs = [];
  let editedImages = [];
  if (garbage && garbage['edited_video']) {
    editedVideos = garbage['edited_video'];
  }
  if (garbage && garbage['edited_pdf']) {
    editedPdfs = garbage['edited_pdf'];
  }
  if (garbage && garbage['edited_image']) {
    editedImages = garbage['edited_image'];
  }

  const company = currentUser.company || 'eXp Realty';

  const _folder_list = await Folder.find({
    user: currentUser.id,
  });

  const _video_list = await Video.find({ user: currentUser.id, del: false })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  const _video_admin = await Video.find({
    role: 'admin',
    del: false,
    _id: { $nin: editedVideos },
    company,
  })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  Array.prototype.push.apply(_video_list, _video_admin);

  const _pdf_list = await PDF.find({ user: currentUser.id, del: false })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  const _pdf_admin = await PDF.find({
    role: 'admin',
    del: false,
    _id: { $nin: editedPdfs },
    company,
  })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  Array.prototype.push.apply(_pdf_list, _pdf_admin);

  const _image_list = await Image.find({
    user: currentUser.id,
    del: false,
    type: { $ne: 'folder' },
  })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  const _image_admin = await Image.find({
    role: 'admin',
    del: false,
    _id: { $nin: editedImages },
    company,
  })
    .sort({ priority: 1 })
    .sort({ created_at: 1 });
  Array.prototype.push.apply(_image_list, _image_admin);

  const teams = await Team.find({
    $or: [{ members: currentUser.id }, { owner: currentUser.id }],
  }).populate([{ path: 'videos' }, { path: 'pdfs' }, { path: 'images' }]);

  const materialOwnerIds = [];
  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const videos = [];
      const pdfs = [];
      const images = [];
      team['videos'].forEach((e) => {
        videos.push({ ...e._doc, team: { _id: team._id, name: team['name'] } });
        materialOwnerIds.push(e.user);
      });
      team['pdfs'].forEach((e) => {
        pdfs.push({ ...e._doc, team: { _id: team._id, name: team['name'] } });
        materialOwnerIds.push(e.user);
      });
      team['images'].forEach((e) => {
        images.push({ ...e._doc, team: { _id: team._id, name: team['name'] } });
        materialOwnerIds.push(e.user);
      });

      Array.prototype.push.apply(_video_list, videos);
      Array.prototype.push.apply(_pdf_list, pdfs);
      Array.prototype.push.apply(_image_list, images);
    }
  }

  const _material_owners = await User.find({
    _id: { $in: materialOwnerIds },
  }).select('_id user_name');
  const _material_owner_objects = {};
  _material_owners.forEach((e) => {
    _material_owner_objects[e._id] = e;
  });

  const _video_detail_list = [];

  for (let i = 0; i < _video_list.length; i++) {
    const view = await VideoTracker.countDocuments({
      video: _video_list[i]._id,
      user: currentUser._id,
    });

    let video_detail;
    if (_video_list[i]._doc) {
      video_detail = {
        ..._video_list[i]._doc,
        views: view,
        material_type: 'video',
      };
    } else {
      video_detail = {
        ..._video_list[i],
        views: view,
        material_type: 'video',
      };
    }

    if (_material_owner_objects[video_detail.user]) {
      video_detail = {
        ...video_detail,
        user: _material_owner_objects[video_detail.user],
      };
    }
    _video_detail_list.push(video_detail);
  }

  const _pdf_detail_list = [];

  for (let i = 0; i < _pdf_list.length; i++) {
    const view = await PDFTracker.countDocuments({
      pdf: _pdf_list[i]._id,
      user: currentUser._id,
    });

    let pdf_detail;
    if (_pdf_list[i]._doc) {
      pdf_detail = {
        ..._pdf_list[i]._doc,
        views: view,
        material_type: 'pdf',
      };
    } else {
      pdf_detail = {
        ..._pdf_list[i],
        views: view,
        material_type: 'pdf',
      };
    }

    if (_material_owner_objects[pdf_detail.user]) {
      pdf_detail = {
        ...pdf_detail,
        user: _material_owner_objects[pdf_detail.user],
      };
    }
    _pdf_detail_list.push(pdf_detail);
  }

  const _image_detail_list = [];

  for (let i = 0; i < _image_list.length; i++) {
    const view = await ImageTracker.countDocuments({
      image: _image_list[i]._id,
      user: currentUser._id,
    });

    let image_detail;
    if (_image_list[i]._doc) {
      image_detail = {
        ..._image_list[i]._doc,
        views: view,
        material_type: 'image',
      };
    } else {
      image_detail = {
        ..._image_list[i],
        views: view,
        material_type: 'image',
      };
    }

    if (_material_owner_objects[image_detail.user]) {
      image_detail = {
        ...image_detail,
        user: _material_owner_objects[image_detail.user],
      };
    }
    _image_detail_list.push(image_detail);
  }

  const _folder_detail_list = [];

  for (let i = 0; i < _folder_list.length; i++) {
    const myJSON = JSON.stringify(_folder_list[i]);
    const _folder = JSON.parse(myJSON);
    const folder = await Object.assign(_folder, {
      material_type: 'folder',
    });
    _folder_detail_list.push(folder);
  }

  res.send({
    status: true,
    data: [
      ..._folder_detail_list,
      ..._video_detail_list,
      ..._pdf_detail_list,
      ..._image_detail_list,
    ],
  });
};

const createFolder = (req, res) => {
  const { currentUser } = req;

  const folder = new Folder({
    ...req.body,
    user: currentUser._id,
  });

  folder
    .save()
    .then((_folder) => {
      return res.send({
        status: true,
        data: _folder,
      });
    })
    .catch((e) => {
      return res.status(500).send({
        status: false,
        error: e.message,
      });
    });
};

const editFolder = async (req, res) => {
  const { currentUser } = req;
  const _id = req.params.id;
  const { title } = req.body;
  const folder = await Folder.findOne({ _id, user: currentUser._id }).catch(
    (err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    }
  );

  if (!folder) {
    return res.status(400).send({
      status: false,
      error: 'Not found folder',
    });
  }

  folder['title'] = title;
  folder
    .save()
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};
const removeFolder = async (req, res) => {
  const { currentUser } = req;
  const { _id, mode } = req.body;

  const folder = await Folder.findOne({ _id, user: currentUser._id }).catch(
    (err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    }
  );

  if (!folder) {
    return res.status(400).send({
      status: false,
      error: 'Not found folder',
    });
  }

  if (mode === 'only-folder') {
    // Skip
  }
  Folder.deleteOne({ _id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};
const moveMaterials = async (req, res) => {
  const { currentUser } = req;
  const { materials, target, source } = req.body;
  const { videos, pdfs, images } = materials;
  if (source) {
    await Folder.updateOne(
      { _id: source, user: currentUser._id },
      {
        $pull: {
          videos: { $in: videos },
          pdfs: { $in: pdfs },
          images: { $in: images },
        },
      }
    );
  }
  if (target) {
    await Folder.updateOne(
      { _id: target, user: currentUser._id },
      {
        $addToSet: {
          videos: { $each: videos },
          images: { $each: images },
          pdfs: { $each: pdfs },
        },
      }
    );
  }
  return res.send({
    status: true,
  });
};

const bulkRemove = async (req, res) => {
  const { videos, pdfs, images } = req.body;
  const { currentUser } = req;
  const error = [];
  const promise_array = [];

  if (videos) {
    for (let i = 0; i < videos.length; i++) {
      const promise = new Promise(async (resolve) => {
        const video = await Video.findOne({
          _id: videos[i],
          user: currentUser.id,
        });

        if (video) {
          if (video['default_edited']) {
            Garbage.updateOne(
              { user: currentUser.id },
              {
                $pull: { edited_video: { $in: [video.default_video] } },
              }
            ).catch((err) => {
              console.log('default video remove err', err.message);
            });
          } else if (video['has_shared']) {
            Video.updateOne(
              {
                _id: video.shared_video,
                user: currentUser.id,
              },
              {
                $unset: { shared_video: true },
                has_shared: false,
              }
            ).catch((err) => {
              console.log('default video remove err', err.message);
            });
          } else {
            const url = video.url;
            if (url.indexOf('teamgrow.s3') > 0) {
              s3.deleteObject(
                {
                  Bucket: api.AWS.AWS_S3_BUCKET_NAME,
                  Key: url.slice(44),
                },
                function (err, data) {
                  console.log('err', err);
                }
              );
            } else {
              try {
                const file_path = video.path;
                if (file_path) {
                  fs.unlinkSync(file_path);
                }
              } catch (err) {
                console.log('err', err);
              }
            }
          }

          if (video.role === 'team') {
            Team.updateOne(
              { videos: videos[i] },
              {
                $pull: { videos: { $in: [videos[i]] } },
              }
            ).catch((err) => {
              console.log('err', err.message);
            });
          }

          Video.updateOne({ _id: videos[i] }, { $set: { del: true } }).catch(
            (err) => {
              console.log('err', err.message);
            }
          );
          resolve();
        } else {
          const video = await Video.findOne({
            _id: videos[i],
          });

          error.push({
            video: {
              _id: videos[i],
              title: video.title,
            },
            error: 'Invalid Permission',
          });

          resolve();
        }
      });
      promise_array.push(promise);
    }
  }

  if (pdfs) {
    for (let i = 0; i < pdfs.length; i++) {
      const promise = new Promise(async (resolve) => {
        const pdf = await PDF.findOne({
          _id: pdfs[i],
          user: currentUser.id,
        });

        if (pdf) {
          if (pdf['default_edited']) {
            Garbage.updateOne(
              { user: currentUser.id },
              {
                $pull: { edited_pdf: { $in: [pdf.default_pdf] } },
              }
            ).catch((err) => {
              console.log('default pdf remove err', err.message);
            });
          } else if (pdf['has_shared']) {
            PDF.updateOne(
              {
                _id: pdf.shared_pdf,
                user: currentUser.id,
              },
              {
                $unset: { shared_pdf: true },
                has_shared: false,
              }
            ).catch((err) => {
              console.log('default pdf remove err', err.message);
            });
          } else {
            const url = pdf.url;
            if (url.indexOf('teamgrow.s3') > 0) {
              s3.deleteObject(
                {
                  Bucket: api.AWS.AWS_S3_BUCKET_NAME,
                  Key: url.slice(44),
                },
                function (err, data) {
                  console.log('err', err);
                }
              );
            }
          }

          if (pdf.role === 'team') {
            Team.updateOne(
              { pdfs: pdfs[i] },
              {
                $pull: { pdfs: { $in: [pdfs[i]] } },
              }
            ).catch((err) => {
              console.log('err', err.message);
            });
          }

          PDF.updateOne({ _id: pdfs[i] }, { $set: { del: true } }).catch(
            (err) => {
              console.log('err', err.message);
            }
          );
          resolve();
        } else {
          const pdf = await PDF.findOne({
            _id: pdfs[i],
          });

          error.push({
            pdf: {
              _id: pdfs[i],
              title: pdf.title,
            },
            error: 'Invalid Permission',
          });

          resolve();
        }
      });
      promise_array.push(promise);
    }
  }

  if (images) {
    for (let i = 0; i < images.length; i++) {
      const promise = new Promise(async (resolve) => {
        const image = await Image.findOne({
          _id: images[i],
          user: currentUser.id,
        });

        if (image) {
          if (image['default_edited']) {
            Garbage.updateOne(
              { user: currentUser.id },
              {
                $pull: { edited_image: { $in: [image.default_image] } },
              }
            ).catch((err) => {
              console.log('default image remove err', err.message);
            });
          } else if (image['has_shared']) {
            Image.updateOne(
              {
                _id: image.shared_image,
                user: currentUser.id,
              },
              {
                $unset: { shared_image: true },
                has_shared: false,
              }
            ).catch((err) => {
              console.log('default image remove err', err.message);
            });
          } else {
            const url = image.url;
            if (url.indexOf('teamgrow.s3') > 0) {
              s3.deleteObject(
                {
                  Bucket: api.AWS.AWS_S3_BUCKET_NAME,
                  Key: url.slice(44),
                },
                function (err, data) {
                  console.log('err', err);
                }
              );
            }
          }

          if (image.role === 'team') {
            Team.updateOne(
              { images: images[i] },
              {
                $pull: { images: { $in: [images[i]] } },
              }
            ).catch((err) => {
              console.log('err', err.message);
            });
          }

          Image.updateOne({ _id: images[i] }, { $set: { del: true } }).catch(
            (err) => {
              console.log('err', err.message);
            }
          );
          resolve();
        } else {
          const image = await Image.findOne({
            _id: images[i],
          });

          error.push({
            image: {
              _id: images[i],
              title: image.title,
            },
            error: 'Invalid Permission',
          });

          resolve();
        }
      });
      promise_array.push(promise);
    }
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
      console.log('material bulk remove err', err.message);
      res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

module.exports = {
  bulkEmail,
  bulkText,
  socialShare,
  thumbsUp,
  loadMaterial,
  createFolder,
  editFolder,
  removeFolder,
  moveMaterials,
  bulkRemove,
};
