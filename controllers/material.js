const User = require('../models/user');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
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
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};

const oauth2 = require('simple-oauth2')(credentials);

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

  let email_count = currentUser['email_info']['count'] || 0;
  const max_email_count =
    currentUser['email_info']['max_count'] ||
    system_settings.EMAIL_DAILY_LIMIT.BASIC;

  const promise_array = [];
  const activities = [];
  let html_content = '';
  let no_connected = false;

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

          video_activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;
          // const html_preview = `<a href="${video_link}"><img src="${preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a>`;
          email_content.replace(new RegExp(`{{${video.id}}}`, 'g'), video_link);

          // const video_object = `<tr style="margin-top:10px;max-width: 800px;"><td><b>${video.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${video_link}"><img src="${preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          // video_objects += video_object;
          activities.push(activity.id);
        }
        email_content = email_content + '<br/>' + video_objects;
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
          const pdf_activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'pdfs',
            pdfs: pdf.id,
            subject: email_subject,
          });

          const activity = await pdf_activity
            .save()
            .then()
            .catch((err) => {
              console.log('activity save err', err.message);
            });

          const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;
          // const html_preview = `<a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a>`;
          email_content.replace(new RegExp(`{{${pdf.id}}}`, 'g'), pdf_link);

          // const pdf_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${pdf.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${pdf_link}"><img src="${pdf.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          // pdf_objects += pdf_object;
          activities.push(activity.id);
        }
        email_content = email_content + '<br/>' + pdf_objects;
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
          const image_activity = new Activity({
            content: activity_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'images',
            images: image.id,
            subject: email_subject,
            description: email_content,
          });

          const activity = await image_activity
            .save()
            .then()
            .catch((err) => {
              console.log('activity image err', err.message);
            });

          const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;
          // const html_preview = `<a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a>`;
          email_content.replace(new RegExp(`{${image.id}}`, 'g'), image_link);

          // const image_object = `<tr style="margin-top:10px;max-width:800px;"><td><b>${image.title}:</b></td></tr><tr style="margin-top:10px;display:block"><td><a href="${image_link}"><img src="${image.preview}?resize=true" alt="Preview image went something wrong. Please click here"/></a></td></tr>`;
          // image_objects += image_object;
          activities.push(activity.id);
        }
        email_content = email_content + '<br/>' + image_objects;
      }

      let activity_content = 'sent email';
      if (req.guest_loggin) {
        activity_content = ActivityHelper.assistantLog(activity_content);
      }

      const new_email = new Email({
        user: currentUser.id,
        subject: email_subject,
        content: email_content,
        cc,
        bcc,
        contacts: contacts[i],
      });

      const email_activity = new Activity({
        content: activity_content,
        contacts: contacts[i],
        user: currentUser.id,
        type: 'emails',
        subject: email_subject,
      });

      const activity = await email_activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err.message);
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

      if (
        currentUser.connected_email_type === 'gmail' ||
        currentUser.connected_email_type === 'gsuit'
      ) {
        const oauth2Client = new google.auth.OAuth2(
          api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
          api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
          urls.GMAIL_AUTHORIZE_URL
        );

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
                Contact.updateOne(
                  { _id: contacts[i] },
                  { $set: { last_activity: activity.id } }
                ).catch((err) => {
                  console.log('err', err.message);
                });

                resolve({
                  status: true,
                });
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
            Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
              console.log('err', err.message);
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

              resolve({
                status: true,
              });
            })
            .catch((err) => {
              Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
                console.log('error', err.message);
              });
              console.log('microsoft email send error', err.message);
              resolve({
                status: false,
                contact: {
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
    return Promise.all(promise_array);
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

module.exports = {
  bulkEmail,
  socialShare,
  thumbsUp,
};
