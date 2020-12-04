const User = require('../models/user');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const ActivityHelper = require('../helpers/activity');
const AWS = require('aws-sdk');
const api = require('../config/api');
const request = require('request-promise');
const createBody = require('gmail-api-create-message-body');
const { google } = require('googleapis');
const { generateUnsubscribeLink } = require('../helpers/email');
const mail_contents = require('../constants/mail_contents');
const urls = require('../constants/urls');
const video = require('../helpers/video');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
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
    attachments,
  } = req.body;

  const pdfs = await PDF.find({ _id: { $in: pdf_ids } }).catch((err) => {
    console.log('pdf find error', err.message);
  });

  const images = await Image.find({ _id: { $in: image_ids } }).catch((err) => {
    console.log('image find error', err.message);
  });

  const promise_array = [];

  if (
    currentUser.connected_email_type === 'gmail' ||
    currentUser.connected_email_type === 'gsuit'
  ) {
    const oauth2Client = new google.auth.OAuth2(
      api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    );

    for (let i = 0; i < contacts.length; i++) {
      let promise;

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
              contact: {
                id: contacts[i],
                first_name: contact.first_name,
                email: contact.email,
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
                first_name: contact.first_name,
                email: contact.email,
              },
              err: 'contact email removed',
            });
          });
          promise_array.push(promise);
          continue;
        }
      }

      if (contact) {
        let email_subject = subject;
        let email_content = content;
        let material_title;
        let activity;

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
          (video_ids.length > 0 && pdf_ids.length > 0) ||
          (video_ids.length > 0 && image_ids.length > 0) ||
          (pdf_ids.length > 0 && image_ids.length > 0)
        ) {
          material_title = mail_contents.MATERIAL_TITLE;
          email_subject = email_subject.replace(
            /{material_title}/gi,
            material_title
          );
        }

        if (video_ids && video_ids.length > 0) {
          let video_titles = '';
          let video_objects = '';
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
            const video_activity = new Activity({
              content: activity_content,
              contacts: contacts[i],
              user: currentUser.id,
              type: 'videos',
              videos: video.id,
              subject: email_subject,
              description: email_content,
            });

            let preview;
            if (video['preview']) {
              preview = video['preview'];
            } else {
              preview = video['thumbnail'];
            }

            activity = await video_activity
              .save()
              .then()
              .catch((err) => {
                console.log('err', err);
              });

            const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
            const video_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
            video_objects += video_object;
          }
          email_content = email_content + '<br/>' + video_objects;
        }

        if (pdf_ids && pdf_ids.length > 0) {
          let pdf_titles = '';
          const pdf_objects = '';
          const pdfs = await PDF.find({ _id: { $in: pdf_ids } }).catch(
            (err) => {
              console.log('pdf find error', err.message);
            }
          );

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
          for (let j = 0; j < videos.length; j++) {
            const video = videos[j];
            const video_activity = new Activity({
              content: activity_content,
              contacts: contacts[i],
              user: currentUser.id,
              type: 'videos',
              videos: video.id,
              subject: email_subject,
              description: email_content,
            });

            let preview;
            if (video['preview']) {
              preview = video['preview'];
            } else {
              preview = video['thumbnail'];
            }

            activity = await video_activity
              .save()
              .then()
              .catch((err) => {
                console.log('err', err);
              });

            const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
            const video_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
            video_objects += video_object;
          }
        }

        const html_content =
          '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">' +
          email_content +
          '<br/>Thank you,<br/>' +
          currentUser.email_signature +
          generateUnsubscribeLink(activity.id) +
          '</body></html>';

        promise = new Promise((resolve, reject) => {
          /* The following example sends a formatted email: */
          try {
            const body = createBody({
              headers: {
                To: contact.email,
                From: `${currentUser.user_name} <${currentUser.connected_email}>`,
                Subject: video_subject,
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
                email_count += 1;
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err);
                });

                const garbage = await Garbage.findOne({ user: currentUser.id });
                const auto_resend = garbage.auto_resend;
                if (auto_resend['enabled']) {
                  const data = { activities, auto_resend };
                  autoResend(data);
                }
                resolve();
              })
              .catch((err) => {
                console.log('gmail video send err', err.message);
                Activity.deleteMany({ _id: { $in: activities } }).catch(
                  (err) => {
                    console.log('err', err.message);
                  }
                );
                if (err.statusCode === 403) {
                  no_connected = true;
                  error.push({
                    contact: {
                      first_name: _contact.first_name,
                      email: _contact.email,
                    },
                    err: 'No Connected Gmail',
                  });
                } else if (err.statusCode === 400) {
                  error.push({
                    contact: {
                      first_name: _contact.first_name,
                      email: _contact.email,
                    },
                    err: err.message,
                  });
                } else {
                  error.push({
                    contact: {
                      first_name: _contact.first_name,
                      email: _contact.email,
                    },
                    err: 'Recipient address required',
                  });
                }
                resolve();
              });
          } catch (err) {
            console.log('gmail video send err', err.message);
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
            });
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: err.message,
            });
            resolve();
          }
        });
        promise_array.push(promise);
      }
    }

    return Promise.all(promise_array);
  }
};
