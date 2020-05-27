const sgMail = require('@sendgrid/mail');
const webpush = require('web-push');
const phone = require('phone');
const moment = require('moment');
const User = require('../models/user');
const Contact = require('../models/contact');
const PDFTracker = require('../models/pdf_tracker');
const PDF = require('../models/pdf');
const VideoTracker = require('../models/video_tracker');
const Video = require('../models/video');
const Image = require('../models/image');
const ImageTracker = require('../models/image_tracker');
const Activity = require('../models/activity');
const TimeLine = require('../models/time_line');
const Garbage = require('../models/garbage');
const FollowUp = require('../models/follow_up');
const Reminder = require('../models/reminder');
const TimeLineCtrl = require('./time_line');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const config = require('../config/config');

const accountSid = config.TWILIO.TWILIO_SID;
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);

const createPDF = async (data) => {
  const pdf_tracker = new PDFTracker({
    ...data,
    updated_at: new Date(),
    created_at: new Date(),
  });
  const pdf = await pdf_tracker.save();
  return pdf;
};

const disconnectPDF = async (pdf_tracker_id) => {
  const query = await PDFTracker.findOne({ _id: pdf_tracker_id });
  const currentUser = await User.findOne({ _id: query['user'] });
  const contact = await Contact.findOne({ _id: query['contact'] });
  const pdf = await PDF.findOne({ _id: query['pdf'] });
  const garbage = await Garbage.findOne({ user: query['user'] });

  const d = query['duration'] / 1000;
  var h = Math.floor(d / 3600);
  var m = Math.floor((d % 3600) / 60);
  var s = Math.floor((d % 3600) % 60);

  if (h < 10) {
    h = '0' + h;
  }
  if (m < 10) {
    m = '0' + m;
  }
  if (s < 10) {
    s = '0' + s;
  }
  const timeWatched = h + ':' + m + ':' + s;

  const desktop_notification = garbage['desktop_notification'];
  // send desktop notification
  if (desktop_notification['material'] === true) {
    webpush.setVapidDetails(
      'mailto:support@crmgrow.com',
      config.VAPID.PUBLIC_VAPID_KEY,
      config.VAPID.PRIVATE_VAPID_KEY
    );

    const subscription = JSON.parse(
      currentUser.desktop_notification_subscription
    );
    const title =
      contact.first_name +
      ' ' +
      contact.last_name +
      ' - ' +
      contact.email +
      ' reviewed pdf -' +
      pdf.title;
    const created_at =
      moment(query['created_at'])
        .utcOffset(currentUser.time_zone)
        .format('MM/DD/YYYY') +
      ' at ' +
      moment(query['created_at'])
        .utcOffset(currentUser.time_zone)
        .format('h:mm a');
    const body = 'Watched ' + timeWatched + ' on ' + created_at;
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

  // send text notification
  if (text_notification['material'] === true) {
    const e164Phone = phone(currentUser.cell_phone)[0];

    if (!e164Phone) {
      const error = {
        error: 'Invalid Phone Number',
      };

      throw error; // Invalid phone number
    } else {
      let fromNumber = currentUser['proxy_number'];
      if (!fromNumber) {
        fromNumber = config.TWILIO.TWILIO_NUMBER;
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
        ' Reviewed pdf: ' +
        pdf.title +
        '\n';
      const created_at =
        moment(query['created_at'])
          .utcOffset(currentUser.time_zone)
          .format('MM/DD/YYYY') +
        ' at ' +
        moment(query['created_at'])
          .utcOffset(currentUser.time_zone)
          .format('h:mm a');
      const body = 'Watched ' + timeWatched + ' on ' + created_at + '\n ';
      const contact_link = urls.CONTACT_PAGE_URL + contact.id;
      twilio.messages
        .create({
          from: fromNumber,
          body: title + '\n' + body + '\n' + contact_link,
          to: e164Phone,
        })
        .catch((err) => {
          console.log('send sms err: ', err);
        });
    }
  }

  const email_notification = garbage['email_notification'];

  if (email_notification['material']) {
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

    const created_at = moment(query['created_at'])
      .utcOffset(currentUser.time_zone)
      .format('h:mm:ss a');
    const msg = {
      to: currentUser.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        subject: `${mail_contents.NOTIFICATION_REVIEWED_PDF.SUBJECT}- ${contact.first_name} ${contact.last_name} - ${created_at}`,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity:
          contact.first_name + ' reviewed pdf - <b>' + pdf.title + '</b>',
        duration: 'Watched <b>' + timeWatched + ' </b>at ' + created_at,
        detailed_activity:
          "<a href='" +
          urls.CONTACT_PAGE_URL +
          contact.id +
          "'><img src='" +
          urls.DOMAIN_URL +
          "assets/images/contact.png'/></a>",
      },
    };

    sgMail
      .send(msg)
      .then()
      .catch((err) => {
        console.log('send message err: ', err);
      });
  }

  const timelines = await TimeLine.find({
    contact: contact.id,
    status: 'active',
    watched_pdf: query['pdf'],
    'condition.case': 'watched_pdf',
    'condition.answer': true,
  }).catch((err) => {
    console.log('err', err);
  });

  if (timelines.length > 0) {
    for (let i = 0; i < timelines.length; i++) {
      try {
        const timeline = timelines[i];
        TimeLineCtrl.runTimeline(timeline.id);
        timeline['status'] = 'completed';
        timeline.save().catch((err) => {
          console.log('err', err);
        });
        const data = {
          contact: contact.id,
          ref: timeline.ref,
        };
        TimeLineCtrl.activeNext(data);
      } catch (err) {
        console.log('err', err);
      }
    }
  }
  const unwatched_timelines = await TimeLine.find({
    contact: contact.id,
    status: 'active',
    watched_pdf: query['pdf'],
    'condition.case': 'watched_pdf',
    'condition.answer': false,
  }).catch((err) => {
    console.log('err', err);
  });
  if (unwatched_timelines.length > 0) {
    for (let i = 0; i < unwatched_timelines.length; i++) {
      const timeline = unwatched_timelines[i];
      TimeLineCtrl.disableNext(timeline.id);
    }
  }

  const activity = new Activity({
    content: contact.first_name + ' reviewed pdf',
    contacts: query.contact,
    user: currentUser.id,
    type: 'pdf_trackers',
    pdf_trackers: query.id,
    pdfs: pdf.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  activity
    .save()
    .then((_activity) => {
      Contact.findByIdAndUpdate(query.contact, {
        $set: { last_activity: _activity.id },
      }).catch((err) => {
        console.log('err', err.message);
      });
    })
    .catch((err) => {
      console.log('err', err.message);
    });
};

const updatePDF = async (duration, pdf_tracker_id) => {
  const pdf_tracker = await PDFTracker.findOne({ _id: pdf_tracker_id });
  pdf_tracker['duration'] = duration;
  pdf_tracker['updated_at'] = new Date();
  pdf_tracker.save();
};

const createVideo = async (data) => {
  const video_tracker = new VideoTracker({
    ...data,
    updated_at: new Date(),
    created_at: new Date(),
  });
  const video = await video_tracker.save();
  return video;
};

const disconnectVideo = async (video_tracker_id) => {
  const query = await VideoTracker.findOne({ _id: video_tracker_id });
  const currentUser = await User.findOne({ _id: query['user'], del: false });
  const contact = await Contact.findOne({ _id: query['contact'] });
  const video = await Video.findOne({ _id: query['video'] });
  const garbage = await Garbage.findOne({ user: query['user'] });

  if (currentUser && contact) {
    const activity = new Activity({
      content: 'watched video',
      contacts: query.contact,
      user: currentUser.id,
      type: 'video_trackers',
      video_trackers: query.id,
      videos: video.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    activity
      .save()
      .then((_activity) => {
        Contact.updateMany(
          { _id: query.contact },
          { $set: { last_activity: _activity.id } }
        ).catch((err) => {
          console.log('err', err.message);
        });
      })
      .catch((err) => {
        console.log('err', err.message);
      });

    const timelines = await TimeLine.find({
      contact: contact.id,
      status: 'active',
      watched_video: query['video'],
      'condition.case': 'watched_video',
      'condition.answer': true,
    }).catch((err) => {
      console.log('err', err);
    });

    if (timelines.length > 0) {
      for (let i = 0; i < timelines.length; i++) {
        try {
          const timeline = timelines[i];
          TimeLineCtrl.runTimeline(timeline.id);
          const data = {
            contact: contact.id,
            ref: timeline.ref,
          };
          TimeLineCtrl.activeNext(data);
        } catch (err) {
          console.log('err', err.message);
        }
      }
    }
    const unwatched_timelines = await TimeLine.find({
      contact: contact.id,
      status: 'active',
      watched_video: query['video'],
      'condition.case': 'watched_video',
      'condition.answer': false,
    }).catch((err) => {
      console.log('err', err);
    });

    if (unwatched_timelines.length > 0) {
      for (let i = 0; i < unwatched_timelines.length; i++) {
        const timeline = unwatched_timelines[i];
        TimeLineCtrl.disableNext(timeline.id);
      }
    }

    const d = query['duration'] / 1000;
    var h = Math.floor(d / 3600);
    var m = Math.floor((d % 3600) / 60);
    var s = Math.floor((d % 3600) % 60);

    if (h < 10) {
      h = '0' + h;
    }
    if (m < 10) {
      m = '0' + m;
    }
    if (s < 10) {
      s = '0' + s;
    }
    const timeWatched = h + ':' + m + ':' + s;

    const tD = Math.floor(video.duration / 1000);
    var tH = Math.floor(tD / 3600);
    var tM = Math.floor((tD % 3600) / 60);
    var tS = Math.floor((tD % 3600) % 60);

    if (tH < 10) {
      tH = '0' + tH;
    }
    if (tM < 10) {
      tM = '0' + tM;
    }
    if (tS < 10) {
      tS = '0' + tS;
    }

    const timeTotal = tH + ':' + tM + ':' + tS;

    const desktop_notification = garbage.desktop_notification;
    // send desktop notification
    if (desktop_notification['material'] === true) {
      webpush.setVapidDetails(
        'mailto:support@crmgrow.com',
        config.VAPID.PUBLIC_VAPID_KEY,
        config.VAPID.PRIVATE_VAPID_KEY
      );

      const subscription = JSON.parse(
        currentUser.desktop_notification_subscription
      );
      const title =
        contact.first_name +
        ' ' +
        contact.last_name +
        ' - ' +
        contact.email +
        ' watched video -' +
        video.title;
      const created_at =
        moment(query['created_at'])
          .utcOffset(currentUser.time_zone)
          .format('MM/DD/YYYY') +
        ' at ' +
        moment(query['created_at'])
          .utcOffset(currentUser.time_zone)
          .format('h:mm a');
      const body =
        'Watched ' + timeWatched + ' of ' + timeTotal + ' on ' + created_at;
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

    const text_notification = garbage.text_notification;
    // send text notification
    if (text_notification['material'] === true && currentUser.cell_phone) {
      const e164Phone = phone(currentUser.cell_phone)[0];

      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number',
        };
        throw error; // Invalid phone number
      } else {
        let fromNumber = currentUser['proxy_number'];
        if (!fromNumber) {
          fromNumber = config.TWILIO.TWILIO_NUMBER;
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
          ' Watched video:' +
          video.title +
          '\n';
        const created_at =
          moment(query['created_at'])
            .utcOffset(currentUser.time_zone)
            .format('MM/DD/YYYY') +
          ' at ' +
          moment(query['created_at'])
            .utcOffset(currentUser.time_zone)
            .format('h:mm a');
        const body =
          'Watched ' + timeWatched + ' of ' + timeTotal + ' on ' + created_at;
        const contact_link = urls.CONTACT_PAGE_URL + contact.id;

        twilio.messages
          .create({
            from: fromNumber,
            body: title + '\n' + body + '\n' + contact_link,
            to: e164Phone,
          })
          .catch((err) => console.error(err));
      }
    }

    const email_notification = garbage.email_notification;
    // send email notification

    if (email_notification['material']) {
      sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
      const created_at = moment(query['created_at'])
        .utcOffset(currentUser.time_zone)
        .format('h:mm: a');

      const msg = {
        to: currentUser.email,
        from: mail_contents.NOTIFICATION_WATCHED_VIDEO.MAIL,
        templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
        dynamic_template_data: {
          subject: `${mail_contents.NOTIFICATION_WATCHED_VIDEO.SUBJECT}- ${contact.first_name} ${contact.last_name} - ${created_at}`,
          first_name: contact.first_name,
          last_name: contact.last_name,
          phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
          email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
          activity:
            contact.first_name + ' watched video - <b>' + video.title + '</b>',
          duration:
            'Watched <b>' +
            timeWatched +
            ' of ' +
            timeTotal +
            ' </b>at ' +
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

    const auto_follow_up = garbage.auto_follow_up;
    if (auto_follow_up['enabled']) {
      const now = moment();
      now.set({ second: 0, millisecond: 0 });
      const follow_due_date = now.add(auto_follow_up.period, 'hours');

      const follow_up = new FollowUp({
        user: currentUser.id,
        contact: contact.id,
        content: auto_follow_up['content'],
        due_date: follow_due_date,
      });

      follow_up
        .save()
        .then(async (_followup) => {
          let reminder_before = 30;
          if (garbage) {
            reminder_before = garbage.reminder_before;
          }

          const startdate = moment(_followup.due_date);
          const reminder_due_date = startdate.subtract(reminder_before, 'mins');

          const reminder = new Reminder({
            contact: contact.id,
            due_date: reminder_due_date,
            type: 'follow_up',
            user: currentUser.id,
            follow_up: _followup.id,
          });

          reminder.save().catch((err) => {
            console.log('reminder save error', err.message);
          });

          const activity = new Activity({
            content: 'added follow up',
            contacts: contact.id,
            user: currentUser.id,
            type: 'follow_ups',
            follow_ups: _followup.id,
          });
          activity.save().catch((err) => {
            console.log('follow error', err.message);
          });
        })
        .catch((err) => {
          console.log('follow error', err.message);
        });
    }
  }
};

const updateVideo = async (duration, video_tracker_id) => {
  const video_tracker = await VideoTracker.findOne({ _id: video_tracker_id });
  video_tracker['duration'] = duration;
  video_tracker['updated_at'] = new Date();
  video_tracker.save();
};

const createImage = async (data) => {
  const image_tracker = new ImageTracker({
    ...data,
    updated_at: new Date(),
    created_at: new Date(),
  });
  const image = await image_tracker.save();
  return image;
};

const disconnectImage = async (image_tracker_id) => {
  const query = await ImageTracker.findOne({ _id: image_tracker_id });
  const currentUser = await User.findOne({ _id: query['user'] });
  const contact = await Contact.findOne({ _id: query['contact'] });
  const image = await Image.findOne({ _id: query['image'] });
  const garbage = await Garbage.findOne({ user: query['user'] });

  const activity = new Activity({
    content: 'reviewed image',
    contacts: query.contact,
    user: currentUser.id,
    type: 'image_trackers',
    image_trackers: query.id,
    images: image.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  activity
    .save()
    .then((_activity) => {
      Contact.findByIdAndUpdate(query.contact, {
        $set: { last_activity: _activity.id },
      }).catch((err) => {
        console.log('err', err);
      });
    })
    .catch((err) => {
      console.log('err', err);
    });

  const timelines = await TimeLine.find({
    contact: contact.id,
    status: 'active',
    watched_image: query['image'],
    'condition.case': 'watched_image',
    'condition.answer': true,
  }).catch((err) => {
    console.log('err', err);
  });

  if (timelines.length > 0) {
    for (let i = 0; i < timelines.length; i++) {
      try {
        const timeline = timelines[i];
        TimeLineCtrl.runTimeline(timeline.id);
        timeline['status'] = 'completed';
        timeline.save().catch((err) => {
          console.log('err', err);
        });
        const data = {
          contact: contact.id,
          ref: timeline.ref,
        };
        TimeLineCtrl.activeNext(data);
      } catch (err) {
        console.log('err', err);
      }
    }
  }
  const unwatched_timelines = await TimeLine.find({
    contact: contact.id,
    status: 'active',
    watched_image: query['image'],
    'condition.case': 'watched_image',
    'condition.answer': false,
  }).catch((err) => {
    console.log('err', err);
  });
  if (unwatched_timelines.length > 0) {
    for (let i = 0; i < unwatched_timelines.length; i++) {
      const timeline = unwatched_timelines[i];
      TimeLineCtrl.disableNext(timeline.id);
    }
  }
  const d = query['duration'] / 1000;
  var h = Math.floor(d / 3600);
  var m = Math.floor((d % 3600) / 60);
  var s = Math.floor((d % 3600) % 60);

  if (h < 10) {
    h = '0' + h;
  }
  if (m < 10) {
    m = '0' + m;
  }
  if (s < 10) {
    s = '0' + s;
  }
  const timeWatched = h + ':' + m + ':' + s;

  const desktop_notification = garbage['desktop_notification'];
  // send desktop notification
  if (desktop_notification['material'] === true) {
    webpush.setVapidDetails(
      'mailto:support@crmgrow.com',
      config.VAPID.PUBLIC_VAPID_KEY,
      config.VAPID.PRIVATE_VAPID_KEY
    );

    const subscription = JSON.parse(
      currentUser.desktop_notification_subscription
    );
    const title =
      contact.first_name +
      ' ' +
      contact.last_name +
      ' - ' +
      contact.email +
      ' reviewed image -' +
      image.title;
    const created_at =
      moment(query['created_at'])
        .utcOffset(currentUser.time_zone)
        .format('MM/DD/YYYY') +
      ' at ' +
      moment(query['created_at'])
        .utcOffset(currentUser.time_zone)
        .format('h:mm a');
    const body = 'Watched ' + timeWatched + ' on ' + created_at;
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
  // send text notification
  if (text_notification['material'] === true) {
    const e164Phone = phone(currentUser.cell_phone)[0];

    if (!e164Phone) {
      const error = {
        error: 'Invalid Phone Number',
      };

      throw error; // Invalid phone number
    } else {
      let fromNumber = currentUser['proxy_number'];
      if (!fromNumber) {
        fromNumber = config.TWILIO.TWILIO_NUMBER;
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
        ' Reviewed image: ' +
        image.title +
        '\n';
      const created_at =
        moment(query['created_at'])
          .utcOffset(currentUser.time_zone)
          .format('MM/DD/YYYY') +
        ' at ' +
        moment(query['created_at'])
          .utcOffset(currentUser.time_zone)
          .format('h:mm a');
      const body = 'Watched ' + timeWatched + ' on ' + created_at + '\n ';
      const contact_link = urls.CONTACT_PAGE_URL + contact.id;
      twilio.messages
        .create({
          from: fromNumber,
          body: title + '\n' + body + '\n' + contact_link,
          to: e164Phone,
        })
        .catch((err) => {
          console.log('send sms err: ', err);
        });
    }
  }

  const email_notification = garbage['email_notification'];
  // send email notification
  if (email_notification['material']) {
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

    const created_at = moment(query['created_at'])
      .utcOffset(currentUser.time_zone)
      .format('h:mm:ss a');
    const msg = {
      to: currentUser.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        subject: `${mail_contents.NOTIFICATION_REVIEWED_IMAGE.SUBJECT}- ${contact.first_name} ${contact.last_name} - ${created_at}`,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity:
          contact.first_name + ' reviewed image - <b>' + image.title + '</b>',
        duration: 'Watched <b>' + timeWatched + ' </b>at ' + created_at,
        detailed_activity: `<a href='${urls.CONTACT_PAGE_URL + contact.id}'><img src='${urls.DOMAIN_URL}assets/images/contact.png'/></a>`,
      },
    };
    console.log('msg', msg);

    sgMail
      .send(msg)
      .then()
      .catch((err) => {
        console.log('send message err: ', err);
      });
  }
};

const updateImage = async (duration, image_tracker_id) => {
  const image_tracker = await ImageTracker.findOne({ _id: image_tracker_id });
  image_tracker['duration'] = duration;
  image_tracker['updated_at'] = new Date();
  image_tracker.save();
};

const setup = (io) => {
  console.info('Setup Socket.io:');
  io.sockets.on('connection', (socket) => {
    socket.emit('connected');
    socket.on('init_pdf', (data) => {
      createPDF(data).then((_pdf_tracker) => {
        socket.type = 'pdf';
        socket.pdf_tracker = _pdf_tracker;
      });
    });

    socket.on('update_pdf', (duration) => {
      const pdf_tracker = socket.pdf_tracker;
      if (typeof pdf_tracker !== 'undefined') {
        updatePDF(duration, pdf_tracker._id).catch((err) => {
          console.log('err', err);
        });
      }
    });

    socket.on('init_video', (data) => {
      createVideo(data).then((_video_tracker) => {
        socket.type = 'video';
        socket.video_tracker = _video_tracker;
      });
    });

    socket.on('update_video', (duration) => {
      const video_tracker = socket.video_tracker;
      if (typeof video_tracker !== 'undefined') {
        updateVideo(duration, video_tracker._id)
          .then(() => {})
          .catch((err) => {
            console.log('err', err);
          });
      }
    });

    socket.on('init_image', (data) => {
      createImage(data).then((_image_tracker) => {
        socket.type = 'image';
        socket.image_tracker = _image_tracker;
      });
    });

    socket.on('update_image', (duration) => {
      const image_tracker = socket.image_tracker;
      if (typeof image_tracker !== 'undefined') {
        updateImage(duration, image_tracker._id)
          .then(() => {})
          .catch((err) => {
            console.log('err', err);
          });
      }
    });

    socket.on('disconnect', () => {
      if (socket.type === 'pdf') {
        console.log('PDF_disconnecting');
        const pdf_tracker = socket.pdf_tracker;
        if (!socket.pdf_tracker.viewed) {
          console.log('PDF disconnected');
          disconnectPDF(pdf_tracker._id);
        }
      } else if (socket.type === 'video') {
        console.log('video_disconnecting');
        const video_tracker = socket.video_tracker;
        if (!socket.video_tracker.viewed) {
          console.log('disconnected');
          disconnectVideo(video_tracker._id);
        }
      } else if (socket.type === 'image') {
        console.log('image_disconnecting');
        const image_tracker = socket.image_tracker;
        if (!socket.image_tracker.viewed) {
          console.log('disconnected');
          console.log('image_tracker', image_tracker);
          disconnectImage(image_tracker._id);
        }
      }
    });

    socket.on('close', () => {
      if (socket.type === 'pdf') {
        console.log('disconnecting with full view');
        const pdf_tracker = socket.pdf_tracker;
        socket.pdf_tracker.viewed = true;
        disconnectPDF(pdf_tracker._id);
      } else if (socket.type === 'video') {
        console.log('disconnecting with full view');
        const video_tracker = socket.video_tracker;
        socket.video_tracker.viewed = true;
        disconnectVideo(video_tracker._id);
      } else if (socket.type === 'image') {
        console.log('disconnectiong with full view');
        const image_tracker = socket.image_tracker;
        socket.image_tracker.viewed = true;
        disconnectImage(image_tracker._id);
      }
    });
    // auth(socket)
  });
};

module.exports = {
  setup,
};
