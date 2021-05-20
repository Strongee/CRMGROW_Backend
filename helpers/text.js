const phone = require('phone');

const User = require('../models/user');
const Contact = require('../models/contact');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Image = require('../models/image');
const Activity = require('../models/activity');
const TimeLine = require('../models/time_line');
const Notification = require('../models/notification');
const Text = require('../models/text');
const Task = require('../models/task');
const ActivityHelper = require('./activity');
const system_settings = require('../config/system_settings');
const api = require('../config/api');

const accountSid = api.TWILIO.TWILIO_SID;
const authToken = api.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);
const request = require('request-promise');
const moment = require('moment');

const urls = require('../constants/urls');
const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const bulkVideo = async (data) => {
  const { user, content, videos, contacts } = data;
  const promise_array = [];

  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('user not found err', err.message);
    }
  );

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          error: 'User not found',
        });
      })
    );
  }
  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent video using sms';
  detail_content = ActivityHelper.automationLog(detail_content);

  for (let i = 0; i < contacts.length; i++) {
    const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
      (err) => {
        console.log('contact not found err', err.message);
      }
    );

    if (!_contact) {
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'Contact not found',
          });
        })
      );
      continue;
    }

    let video_titles = '';
    let video_descriptions = '';
    let video_objects = '';
    let video_content = content;
    let activity;
    for (let j = 0; j < videos.length; j++) {
      const video = videos[j];

      if (typeof video_content === 'undefined') {
        video_content = '';
      }

      video_content = video_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.email)
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
        send_type: 1,
        videos: video._id,
        description: video_content,
      });

      activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });

      const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id;

      if (j < videos.length - 1) {
        video_titles = video_titles + video.title + ', ';
        video_descriptions += `${video.description}, `;
      } else {
        video_titles += video.title;
        video_descriptions += video.description;
      }
      const video_object = `\n${video.title}:\n\n${video_link}\n`;
      video_objects += video_object;
    }

    if (video_content.search(/{video_object}/gi) !== -1) {
      video_content = video_content.replace(/{video_object}/gi, video_objects);
    } else {
      video_content = video_content + '\n' + video_objects;
    }

    if (video_content.search(/{video_title}/gi) !== -1) {
      video_content = video_content.replace(/{video_title}/gi, video_titles);
    }

    if (video_content.search(/{video_description}/gi) !== -1) {
      video_content = video_content.replace(
        /{video_description}/gi,
        video_descriptions
      );
    }

    let fromNumber = currentUser['proxy_number'];

    if (!fromNumber) {
      fromNumber = await getSignalWireNumber(currentUser.id);
    }

    const promise = new Promise((resolve, reject) => {
      const e164Phone = phone(_contact.cell_phone)[0];

      if (!e164Phone) {
        Activity.deleteOne({ _id: activity.id }).catch((err) => {
          console.log('err', err);
        });
        resolve({
          contact: contacts[i],
          error: 'Phone number is not valid format',
          status: false,
        }); // Invalid phone number
      }

      client.messages
        .create({
          from: fromNumber,
          to: e164Phone,
          body: video_content,
        })
        .then((message) => {
          if (message.status === 'queued' || message.status === 'sent') {
            console.log('Message ID: ', message.sid);
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              video_content
            );

            const now = moment();
            const due_date = now.add(1, 'minutes');
            const timeline = new TimeLine({
              user: currentUser.id,
              status: 'active',
              action: {
                type: 'bulk_sms',
                message_sid: message.sid,
                activities: [activity.id],
              },
              due_date,
            });
            timeline.save().catch((err) => {
              console.log('time line save err', err.message);
            });

            Activity.updateOne(
              { _id: activity.id },
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
              activities: [activity.id],
              criteria: 'bulk_sms',
              status: 'pending',
            });
            notification.save().catch((err) => {
              console.log('notification save err', err.message);
            });
            resolve({ status: true });
          } else if (message.status === 'delivered') {
            console.log('Message ID: ', message.sid);
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              video_content
            );
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve({ status: true });
          } else {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              contact: contacts[i],
              error: message.error_message,
              status: false,
            });
          }
        })
        .catch((err) => {
          Activity.deleteOne({ _id: activity.id }).catch((err) => {
            console.log('err', err);
          });
          resolve({
            contact: contacts[i],
            error: err,
            status: false,
          });
        });
    });
    promise_array.push(promise);
  }

  return Promise.all(promise_array);
};

const bulkPDF = async (data) => {
  const { user, content, pdfs, contacts } = data;
  const promise_array = [];
  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          error: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent pdf using sms';
  detail_content = ActivityHelper.automationLog(detail_content);

  for (let i = 0; i < contacts.length; i++) {
    const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    if (!_contact) {
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'Contact not found',
          });
        })
      );
      continue;
    }

    let pdf_titles = '';
    let pdf_descriptions = '';
    let pdf_objects = '';
    let pdf_content = content;
    let activity;

    for (let j = 0; j < pdfs.length; j++) {
      const pdf = pdfs[j];

      if (!pdf_content) {
        pdf_content = '';
      }

      pdf_content = pdf_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.email)
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
        send_type: 1,
        pdfs: pdf._id,
        created_at: new Date(),
        updated_at: new Date(),
        description: pdf_content,
      });

      activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });

      const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id;

      if (j < pdfs.length - 1) {
        pdf_titles = pdf_titles + pdf.title + ', ';
        pdf_descriptions += `${pdf.description}, `;
      } else {
        pdf_titles += pdf.title;
        pdf_descriptions += pdf.description;
      }
      const pdf_object = `\n${pdf.title}:\n\n${pdf_link}\n`;
      pdf_objects += pdf_object;
    }

    if (pdf_content.search(/{pdf_object}/gi) !== -1) {
      pdf_content = pdf_content.replace(/{pdf_object}/gi, pdf_objects);
    } else {
      pdf_content = pdf_content + '\n' + pdf_objects;
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

    let fromNumber = currentUser['proxy_number'];

    if (!fromNumber) {
      fromNumber = await getSignalWireNumber(currentUser.id);
    }

    const promise = new Promise(async (resolve, reject) => {
      const e164Phone = phone(_contact.cell_phone)[0];

      if (!e164Phone) {
        Activity.deleteOne({ _id: activity.id }).catch((err) => {
          console.log('err', err);
        });
        resolve({
          status: false,
          contact: contacts[i],
        }); // Invalid phone number
      }
      client.messages
        .create({
          from: fromNumber,
          to: e164Phone,
          body: pdf_content,
        })
        .then((message) => {
          if (message.status === 'queued' || message.status === 'sent') {
            console.log('Message ID: ', message.sid);
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              pdf_content
            );

            const now = moment();
            const due_date = now.add(1, 'minutes');
            const timeline = new TimeLine({
              user: currentUser.id,
              status: 'active',
              action: {
                type: 'bulk_sms',
                message_sid: message.sid,
                activities: [activity.id],
              },
              due_date,
            });
            timeline.save().catch((err) => {
              console.log('time line save err', err.message);
            });

            Activity.updateOne(
              { _id: activity.id },
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
              activities: [activity.id],
              criteria: 'bulk_sms',
              status: 'pending',
            });
            notification.save().catch((err) => {
              console.log('notification save err', err.message);
            });
            resolve({ status: true });
          } else if (message.status === 'delivered') {
            console.log('Message ID: ', message.sid);
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              pdf_content
            );
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve({ status: true });
          } else {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              contact: contacts[i],
              error: message.error_message,
              status: false,
            });
          }

          // if (message.status !== 'undelivered') {
          //   console.log('Message ID: ', message.sid);
          //   console.info(
          //     `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
          //     pdf_content
          //   );
          //   Contact.updateOne(
          //     { _id: contacts[i] },
          //     {
          //       $set: { last_activity: activity.id },
          //     }
          //   ).catch((err) => {
          //     console.log('err', err);
          //   });
          //   resolve({
          //     status: true,
          //   });
          // } else {
          //   console.log('video message send err1', message.error_message);
          //   Activity.deleteOne({ _id: activity.id }).catch((err) => {
          //     console.log('err', err);
          //   });
          //   resolve({
          //     contact: contacts[i],
          //     error: message.error_message,
          //     status: false,
          //   });
          // }
        })
        .catch((err) => {
          Activity.deleteOne({ _id: activity.id }).catch((err) => {
            console.log('err', err);
          });
          resolve({
            contact: contacts[i],
            error: err,
            status: false,
          });
        });
    });
    promise_array.push(promise);
  }

  return Promise.all(promise_array);
};

const bulkImage = async (data) => {
  const { user, content, images, contacts } = data;
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
          error: 'User not found',
        });
      })
    );
  }

  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'sent image using sms';
  detail_content = ActivityHelper.automationLog(detail_content);

  for (let i = 0; i < contacts.length; i++) {
    const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
      (err) => {
        console.log('err', err);
      }
    );

    if (!_contact) {
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'Contact not found',
          });
        })
      );
      continue;
    }

    let image_titles = '';
    let image_descriptions = '';
    let image_objects = '';
    let image_content = content;
    let activity;
    for (let j = 0; j < images.length; j++) {
      const image = images[j];

      if (!image_content) {
        image_content = '';
      }

      image_content = image_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.email)
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
        send_type: 1,
        images: image._id,
        description: image_content,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity = await _activity
        .save()
        .then()
        .catch((err) => {
          console.log('err', err);
        });

      const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id;

      if (j < images.length - 1) {
        image_titles = image_titles + image.title + ', ';
        image_descriptions += `${image.description}, `;
      } else {
        image_titles += image.title;
        image_descriptions += image.description;
      }
      const image_object = `\n${image.title}:\n\n${image_link}\n`;
      image_objects += image_object;
    }

    if (image_content.search(/{image_object}/gi) !== -1) {
      image_content = image_content.replace(/{image_object}/gi, image_objects);
    } else {
      image_content = image_content + '\n' + image_objects;
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

    let fromNumber = currentUser['proxy_number'];

    if (!fromNumber) {
      fromNumber = await getSignalWireNumber(currentUser.id);
    }

    const promise = new Promise(async (resolve, reject) => {
      const e164Phone = phone(_contact.cell_phone)[0];

      if (!e164Phone) {
        Activity.deleteOne({ _id: activity.id }).catch((err) => {
          console.log('err', err);
        });
        resolve({
          status: false,
          contact: contacts[i],
        });
      }

      client.messages
        .create({
          from: fromNumber,
          to: e164Phone,
          body: image_content,
        })
        .then((message) => {
          if (message.status === 'queued' || message.status === 'sent') {
            console.log('Message ID: ', message.sid);
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              image_content
            );

            const now = moment();
            const due_date = now.add(1, 'minutes');
            const timeline = new TimeLine({
              user: currentUser.id,
              status: 'active',
              action: {
                type: 'bulk_sms',
                message_sid: message.sid,
                activities: [activity.id],
              },
              due_date,
            });
            timeline.save().catch((err) => {
              console.log('time line save err', err.message);
            });

            Activity.updateOne(
              { _id: activity.id },
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
              activities: [activity.id],
              criteria: 'bulk_sms',
              status: 'pending',
            });
            notification.save().catch((err) => {
              console.log('notification save err', err.message);
            });
            resolve({ status: true });
          } else if (message.status === 'delivered') {
            console.log('Message ID: ', message.sid);
            console.info(
              `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
              image_content
            );
            Contact.updateOne(
              { _id: contacts[i] },
              {
                $set: { last_activity: activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            resolve({ status: true });
          } else {
            Activity.deleteOne({ _id: activity.id }).catch((err) => {
              console.log('err', err);
            });
            resolve({
              contact: contacts[i],
              error: message.error_message,
              status: false,
            });
          }
        })
        .catch((err) => {
          Activity.deleteOne({ _id: activity.id }).catch((err) => {
            console.log('err', err);
          });
          resolve({
            contact: contacts[i],
            error: err,
            status: false,
          });
        });
    });
    promise_array.push(promise);
  }
  return Promise.all(promise_array);
};

const resendVideo = async (data) => {
  const { user, content, activities, videos, contacts } = data;
  const promise_array = [];

  const currentUser = await User.findOne({ _id: user, del: false }).catch(
    (err) => {
      console.log('user not found err', err.message);
    }
  );

  if (!currentUser) {
    promise_array.push(
      new Promise((resolve, reject) => {
        resolve({
          status: false,
          error: 'User not found',
        });
      })
    );
  }
  if (promise_array.length > 0) {
    return Promise.all(promise_array);
  }

  let detail_content = 'resent video using sms';
  detail_content = ActivityHelper.autoSettingLog(detail_content);

  for (let i = 0; i < contacts.length; i++) {
    const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
      (err) => {
        console.log('contact not found err', err.message);
      }
    );

    if (!_contact) {
      promise_array.push(
        new Promise((resolve, reject) => {
          resolve({
            status: false,
            error: 'Contact not found',
          });
        })
      );
      continue;
    }

    let video_titles = '';
    let video_descriptions = '';
    let video_objects = '';
    let video_content = content;
    let activity;
    for (let j = 0; j < activities.length; j++) {
      activity = activities[j];
      const video = await Video.findOne({ _id: videos[j] });

      if (typeof video_content === 'undefined') {
        video_content = '';
      }

      video_content = video_content
        .replace(/{user_name}/gi, currentUser.user_name)
        .replace(/{user_email}/gi, currentUser.email)
        .replace(/{user_phone}/gi, currentUser.cell_phone)
        .replace(/{contact_first_name}/gi, _contact.first_name)
        .replace(/{contact_last_name}/gi, _contact.last_name)
        .replace(/{contact_email}/gi, _contact.email)
        .replace(/{contact_phone}/gi, _contact.cell_phone);

      const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity;

      if (j < videos.length - 1) {
        video_titles = video_titles + video.title + ', ';
        video_descriptions += `${video.description}, `;
      } else {
        video_titles += video.title;
        video_descriptions += video.description;
      }
      const video_object = `\n${video.title}:\n\n${video_link}\n`;
      video_objects += video_object;
    }

    if (video_content.search(/{video_object}/gi) !== -1) {
      video_content = video_content.replace(/{video_object}/gi, video_objects);
    } else {
      video_content = video_content + '\n' + video_objects;
    }

    if (video_content.search(/{video_title}/gi) !== -1) {
      video_content = video_content.replace(/{video_title}/gi, video_titles);
    }

    if (video_content.search(/{video_description}/gi) !== -1) {
      video_content = video_content.replace(
        /{video_description}/gi,
        video_descriptions
      );
    }

    let fromNumber = currentUser['proxy_number'];

    if (!fromNumber) {
      fromNumber = await getSignalWireNumber(currentUser.id);
    }

    const promise = new Promise((resolve, reject) => {
      const e164Phone = phone(_contact.cell_phone)[0];

      if (!e164Phone) {
        resolve({
          contact: contacts[i],
          error: 'Phone number is not valid format',
          status: false,
        }); // Invalid phone number
      }

      client.messages
        .create({
          from: fromNumber,
          to: e164Phone,
          body: video_content,
        })
        .then(async (message) => {
          console.log('Message ID: ', message.sid);

          const _activity = new Activity({
            content: detail_content,
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: videos[0],
            description: video_content,
          });

          const resend_activity = await _activity
            .save()
            .then()
            .catch((err) => {
              console.log('err', err);
            });

          Contact.updateOne(
            { _id: contacts[i] },
            {
              $set: { last_activity: resend_activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
          resolve({
            status: true,
          });
        })
        .catch((err) => {
          resolve({
            contact: contacts[i],
            error: err,
            status: false,
          });
        });
    });
    promise_array.push(promise);
  }

  return Promise.all(promise_array);
};

const getTwilioNumber = async (id) => {
  const user = await User.findOne({ _id: id }).catch((err) => {
    console.log('err', err);
  });
  let areaCode;
  let countryCode;
  let fromNumber;
  const phone = user.phone;
  if (phone) {
    areaCode = phone.areaCode;
    countryCode = phone.countryCode;
  } else {
    areaCode = user.cell_phone.substring(1, 4);
    countryCode = 'US';
  }
  const data = await twilio
    .availablePhoneNumbers(countryCode)
    .local.list({
      areaCode,
    })
    .catch((err) => {
      console.log('phone number get err', err);
      fromNumber = api.TWILIO.TWILIO_NUMBER;
      return fromNumber;
    });

  if (fromNumber) {
    return fromNumber;
  }

  let number = data[0];

  if (typeof number === 'undefined' || number === '+') {
    const areaCode1 = areaCode.slice(1);

    const data1 = await twilio
      .availablePhoneNumbers(countryCode)
      .local.list({
        areaCode: areaCode1,
      })
      .catch((err) => {
        console.log('phone number get err', err);
        fromNumber = api.TWILIO.TWILIO_NUMBER;
        return fromNumber;
      });
    number = data1[0];
  }

  if (fromNumber) {
    return fromNumber;
  }

  if (typeof number !== 'undefined' && number !== '+') {
    const proxy_number = await twilio.incomingPhoneNumbers
      .create({
        phoneNumber: number.phoneNumber,
        smsUrl: urls.SMS_RECEIVE_URL,
      })
      .then()
      .catch((err) => {
        console.log('proxy number error', err);
      });

    user['proxy_number'] = proxy_number.phoneNumber;
    fromNumber = proxy_number.phoneNumber;
    user.save().catch((err) => {
      console.log('err', err.message);
    });
  } else {
    fromNumber = api.TWILIO.TWILIO_NUMBER;
  }

  return fromNumber;
};

const getSignalWireNumber = async (id) => {
  const user = await User.findOne({ _id: id }).catch((err) => {
    console.log('err', err);
  });
  let areaCode;
  let countryCode;
  let fromNumber;
  const phone = user.phone;
  if (phone) {
    areaCode = phone.areaCode;
    countryCode = phone.countryCode;
  } else {
    areaCode = user.cell_phone.substring(1, 4);
    countryCode = 'US';
  }

  const response = await request({
    method: 'GET',
    uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers/search`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: api.SIGNALWIRE.PROJECT_ID,
      password: api.SIGNALWIRE.TOKEN,
    },
    qs: {
      areacode: areaCode,
    },
    json: true,
  }).catch((err) => {
    console.log('phone number get err', err);
    fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
    return fromNumber;
  });

  if (fromNumber) {
    return fromNumber;
  }

  const number = response.data[0];

  if (number) {
    const proxy_number = await request({
      method: 'POST',
      uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers`,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        user: api.SIGNALWIRE.PROJECT_ID,
        password: api.SIGNALWIRE.TOKEN,
      },
      body: {
        number: number.e164,
      },
      json: true,
    }).catch((err) => {
      console.log('phone number get err', err);
      fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
      return fromNumber;
    });

    if (fromNumber) {
      return fromNumber;
    }

    request({
      method: 'PUT',
      uri: `${api.SIGNALWIRE.WORKSPACE}/api/relay/rest/phone_numbers/${proxy_number.id}`,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        user: api.SIGNALWIRE.PROJECT_ID,
        password: api.SIGNALWIRE.TOKEN,
      },
      body: {
        name: user.user_name,
        message_request_url: urls.SMS_RECEIVE_URL1,
      },
      json: true,
    }).catch((err) => {
      console.log('phone number update redirect err', err);
    });

    fromNumber = proxy_number.number;
    await User.updateOne(
      { _id: id },
      {
        $set: {
          proxy_number: fromNumber,
          proxy_number_id: proxy_number.id,
        },
      }
    ).catch((err) => {
      console.log('err', err.message);
    });
  } else {
    fromNumber = api.SIGNALWIRE.DEFAULT_NUMBER;
  }

  return fromNumber;
};

const matchUSPhoneNumber = (phoneNumberString) => {
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  let phoneNumber;
  if (match) {
    phoneNumber = '(' + match[2] + ') ' + match[3] + '-' + match[4];
  }
  return phoneNumber;
};

const getStatus = (id, service) => {
  if (service === 'twilio') {
    return twilio.messages(id).fetch();
  } else {
    return client.messages(id).fetch();
  }
};

const releaseSignalWireNumber = (phoneNumberSid) => {
  client
    .incomingPhoneNumbers(phoneNumberSid)
    .remove()
    .then((incoming_phone_number) => console.log(incoming_phone_number.sid))
    .done();
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const generateUnsubscribeLink = () => {
  return '\n\nReply STOP to unsubscribe.';
};

const releaseTwilioNumber = (phoneNumberSid) => {
  twilio
    .incomingPhoneNumbers(phoneNumberSid)
    .remove()
    .then(function (deleted) {
      // Success
      console.log('twilio number deleted');
    })
    .catch(function (error) {
      // Handle error
    });
};

const sendText = async (data) => {
  const {
    user,
    video_ids,
    pdf_ids,
    image_ids,
    content,
    contacts,
    mode,
    max_text_count,
    shared_text,
    has_shared,
    is_guest,
    textProcessId,
  } = data;

  const currentUser = await User.findOne({ _id: user }).catch((err) => {
    console.log('user find err', err.message);
  });

  const promise_array = [];

  const text_info = currentUser.text_info;
  let count = 0;
  let additional_sms_credit = 0;

  for (let i = 0; i < contacts.length; i++) {
    let text_content = content;
    const activities = [];

    const _contact = await Contact.findOne({ _id: contacts[i] }).catch(
      (err) => {
        console.log('contact update err', err.messgae);
      }
    );

    let promise;

    if (
      text_info['is_limit'] &&
      max_text_count <= count &&
      !additional_sms_credit
    ) {
      promise = new Promise(async (resolve) => {
        resolve({
          status: false,
          contact: {
            _id: _contact._id,
            first_name: _contact.first_name,
            cell_phone: _contact.cell_phone,
          },
          error: 'Additional count required',
        });
      });
      promise_array.push(promise);
      continue;
    }

    const e164Phone = phone(_contact.cell_phone)[0];
    if (!e164Phone) {
      promise = new Promise(async (resolve) => {
        resolve({
          status: false,
          contact: {
            _id: _contact._id,
            first_name: _contact.first_name,
            cell_phone: _contact.cell_phone,
          },
          error: 'Invalid number',
        });
      });
      promise_array.push(promise);
      continue;
    }

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

    if (is_guest) {
      activity_content = ActivityHelper.assistantLog(activity_content);
    }

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

    const text = new Text({
      user: currentUser.id,
      content: text_content,
      contacts: contacts[i],
      type: 0,
      shared_text,
      has_shared,
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
    const body = _contact.texted_unsbcription_link
      ? text_content
      : text_content + generateUnsubscribeLink();

    if (fromNumber) {
      promise = new Promise(async (resolve) => {
        client.messages
          .create({
            from: fromNumber,
            to: e164Phone,
            body,
          })
          .then((message) => {
            if (text_info['is_limit'] && max_text_count <= count) {
              additional_sms_credit -= 1;
            } else {
              count += 1;
            }
            if (message.status === 'queued' || message.status === 'sent') {
              console.log('Message ID: ', message.sid);
              console.info(
                `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                text_content
              );

              if (contacts.length > 1) {
                const time = moment().add(1, 'minutes');
                createTextCheckTasks(
                  currentUser,
                  _contact,
                  message,
                  'signal',
                  activities,
                  activity._id,
                  text._id,
                  textProcessId,
                  time
                );
                resolve({
                  status: true,
                  contact: _contact,
                });
              } else {
                const interval_id = setInterval(function () {
                  let j = 0;
                  getStatus(message.sid).then((res) => {
                    j++;
                    if (res.status === 'delivered') {
                      clearInterval(interval_id);
                      // Handle delivered text
                      handleDeliveredText(_contact._id, activities, activity._id, text._id);

                      resolve({
                        status: true,
                        contact: _contact,
                      });
                    } else if (res.status === 'sent' && j >= 5) {
                      clearInterval(interval_id);
                      // Handle failed text with status 3
                      handleFailedText(activities, activity._id, text._id, 3);

                      resolve({
                        status: false,
                        contact: {
                          _id: _contact._id,
                          first_name: _contact.first_name,
                          cell_phone: _contact.cell_phone,
                        },
                        error: message.error_message,
                      });
                    } else if (res.status === 'undelivered') {
                      clearInterval(interval_id);
                      // Handle with 4 status
                      handleFailedText(activities, activity._id, text._id, 4);

                      resolve({
                        status: false,
                        contact: {
                          _id: _contact._id,
                          first_name: _contact.first_name,
                          cell_phone: _contact.cell_phone,
                        },
                        error: message.error_message,
                      });
                    }
                  });
                }, 1000);
              }
            } else if (message.status === 'delivered') {
              console.log('Message ID: ', message.sid);
              console.info(
                `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                text_content
              );
              handleDeliveredText(_contact._id, activities, activity._id, text._id);

              resolve({
                status: true,
                contact: _contact,
              });
            } else {
              // Handle Failed Text
              handleFailedText(activities, activity._id, text._id, 4);

              resolve({
                status: false,
                contact: {
                  _id: _contact._id,
                  first_name: _contact.first_name,
                  cell_phone: _contact.cell_phone,
                },
                error: message.error_message || 'message response is lost',
              });
            }
          })
          .catch((err) => {
            console.log('video message send err', err);
            // Handle Failed Text
            revertTexting(activities, activity._id, text._id);

            resolve({
              status: false,
              contact: {
                _id: _contact._id,
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              error: err.message || 'Message creating is failed',
            });
          });
      });
    } else {
      fromNumber = currentUser['twilio_number'];
      promise = new Promise(async (resolve) => {
        twilio.messages
          .create({
            from: fromNumber,
            body,
            to: e164Phone,
          })
          .then((message) => {
            if (text_info['is_limit'] && max_text_count <= count) {
              additional_sms_credit -= 1;
            } else {
              count += 1;
            }

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

              if (contacts.length > 1) {
                const time = moment().add(1, 'minutes');
                createTextCheckTasks(
                  currentUser,
                  _contact,
                  message,
                  'signal',
                  activities,
                  activity._id,
                  text._id,
                  textProcessId,
                  time
                );

                resolve({
                  status: true,
                  contact: _contact,
                });
              } else {
                const interval_id = setInterval(function () {
                  let j = 0;
                  getStatus(message.sid, 'twilio').then((res) => {
                    j++;
                    if (res.status === 'delivered') {
                      clearInterval(interval_id);
                      // Handle delivered Text
                      handleDeliveredText(_contact._id, activities, activity._id, text._id);
                      resolve({
                        status: true,
                        contact: _contact,
                      });
                    } else if (res.status === 'sent' && j >= 5) {
                      clearInterval(interval_id);
                      // Handle Failed Text with Status 3
                      handleFailedText(activities, activity._id, text._id, 3);

                      resolve({
                        status: false,
                        contact: {
                          _id: _contact._id,
                          first_name: _contact.first_name,
                          cell_phone: _contact.cell_phone,
                        },
                        error: message.error_message,
                      });
                    } else if (res.status === 'undelivered') {
                      clearInterval(interval_id);
                      // Handle Failed Text with Status 4
                      handleFailedText(activities, activity._id, text._id, 4);

                      resolve({
                        status: false,
                        contact: {
                          _id: _contact._id,
                          first_name: _contact.first_name,
                          cell_phone: _contact.cell_phone,
                        },
                        error: message.error_message,
                      });
                    }
                  });
                }, 1000);
              }
            } else if (message.status === 'delivered') {
              console.log('Message ID: ', message.sid);
              console.info(
                `Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`,
                text_content
              );
              // Handle delivered Text
              handleDeliveredText(_contact._id, activities, activity._id, text._id);
              resolve({
                status: true,
              });
            } else {
              handleFailedText(activities, activity._id, text._id, 4);
              resolve({
                status: false,
                contact: {
                  _id: _contact._id,
                  first_name: _contact.first_name,
                  cell_phone: _contact.cell_phone,
                },
                error: message.error_message || 'message response is lost',
              });
            }
          })
          .catch((err) => {
            revertTexting(activities, activity._id, text._id);

            resolve({
              status: false,
              contact: {
                _id: _contact._id,
                first_name: _contact.first_name,
                cell_phone: _contact.cell_phone,
              },
              error: err.message || 'Message creating is failed',
            });
          });
      });
    }
    promise_array.push(promise);
  }

  promise_array.push(
    new Promise((resolve) => {
      resolve({
        type: 'exec_result',
        count,
        additional_sms_credit,
      });
    })
  );
  return Promise.all(promise_array);
};

const handleFailedText = (activities, text_activity, text_id, status) => {
  Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
    console.log('text material activity delete err', err.message);
  });

  // TODO: Update the Text Activity with error or consider about this.

  Text.updateOne(
    {
      _id: text_id,
    },
    {
      $set: {
        status,
      },
    }
  ).catch((err) => {
    console.log('text update err', err.message);
  });
};

const handleDeliveredText = (
  contact_id,
  activities,
  text_activity,
  text_id
) => {
  Text.updateOne(
    {
      _id: text_id,
    },
    {
      $set: {
        status: 2,
      },
    }
  ).catch((err) => {
    console.log('text update err', err.message);
  });

  Activity.updateMany(
    { _id: { $in: activities } },
    {
      $set: { texts: text_id, status: 'completed' },
    }
  ).catch((err) => {
    console.log('activity update err', err.message);
  });

  Contact.updateOne(
    { _id: contact_id },
    {
      $set: {
        last_activity: text_activity,
        texted_unsbcription_link: true,
      },
    }
  ).catch((err) => {
    console.log('contact update err', err.message);
  });
};

const revertTexting = (activities, text_activity, text_id) => {
  Activity.deleteMany({ _id: { $in: activities } }).catch((err) => {
    console.log('text material activity delete err', err.message);
  });
  Activity.deleteOne({ _id: text_activity }).catch((err) => {
    console.log('text activity delete err', err.message);
  });
  Text.deleteOne({ _id: text_id }).catch((err) => {
    console.log('activity delete err', err.message);
  });
};

const createTextCheckTasks = (
  user,
  contact,
  message,
  service,
  activities,
  text_activity,
  text_id,
  process_id,
  time
) => {
  const task = new Task({
    user: user.id,
    status: 'active',
    type: 'bulk_sms',
    action: {
      message_sid: message.sid,
      activities,
      service,
      activity: text_activity,
      text: text_id,
    },
    contacts: [contact._id],
    due_date: time,
    process: process_id,
  });

  task.save().catch((err) => {
    console.log('time line save err', err.message);
  });

  Activity.updateOne(
    { _id: text_activity },
    {
      $set: {
        status: 'pending',
      },
    }
  ).catch((err) => {
    console.log('activity err', err.message);
  });

  Activity.updateMany(
    { _id: { $in: activities } },
    {
      $set: {
        status: 'pending',
        texts: text_id,
      },
    }
  ).catch((err) => {
    console.log('activity err', err.message);
  });
};

module.exports = {
  sendText,
  bulkVideo,
  bulkPDF,
  bulkImage,
  resendVideo,
  getTwilioNumber,
  getSignalWireNumber,
  getStatus,
  matchUSPhoneNumber,
  generateUnsubscribeLink,
  releaseSignalWireNumber,
  releaseTwilioNumber,
  sleep,
  handleDeliveredText,
  handleFailedText,
};
