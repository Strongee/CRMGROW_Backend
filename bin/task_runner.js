const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;
const fs = require('fs');
const uuidv1 = require('uuid/v1');
const AWS = require('aws-sdk');
const phone = require('phone');
const webpush = require('web-push');
const sharp = require('sharp');
const child_process = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
const { ENV_PATH } = require('../config/path');

require('dotenv').config({ path: ENV_PATH });

const User = require('../models/user');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const FollowUp = require('../models/follow_up');
const Reminder = require('../models/reminder');
const Appointment = require('../models/appointment');
const Video = require('../models/video');
const Note = require('../models/note');
const Notification = require('../models/notification');
const TimeLine = require('../models/time_line');
const Garbage = require('../models/garbage');
const CampaignJob = require('../models/campaign_job');
const EmailTemplate = require('../models/email_template');
const Text = require('../models/text');
const Task = require('../models/task');
const TimeLineCtrl = require('../controllers/time_line');

const api = require('../config/api');
const system_settings = require('../config/system_settings');
const urls = require('../constants/urls');
const notifications = require('../constants/notification');
const mail_contents = require('../constants/mail_contents');
const { VIDEO_PATH, TEMP_PATH } = require('../config/path');
const { sendNotificationEmail } = require('../helpers/email');
const { RestClient } = require('@signalwire/node');

const client = new RestClient(api.SIGNALWIRE.PROJECT_ID, api.SIGNALWIRE.TOKEN, {
  signalwireSpaceUrl: api.SIGNALWIRE.WORKSPACE_DOMAIN,
});

const EmailHelper = require('../helpers/email');
const TextHelper = require('../helpers/text');
const FileHelper = require('../helpers/file');
const ActivityHelper = require('../helpers/activity');

const { DB_PORT } = require('../config/database');
const { result } = require('lodash');

mongoose.set('useCreateIndex', true);
mongoose
  .connect(DB_PORT, { useNewUrlParser: true })
  .then(() => console.log('Connecting to database successful'))
  .catch((err) => console.error('Could not connect to mongo DB', err));

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const task_check = new CronJob(
  '* * * * *',
  async () => {
    const due_date = new Date();
    const tasks = await Task.find({
      status: 'active',
      due_date: { $lte: due_date },
    });

    if (tasks) {
      for (let i = 0; i < tasks.length; i++) {
        const timeline = tasks[i];
        const action = timeline['action'];
        let data;
        if (!action) {
          continue;
        }
        switch (timeline.type) {
          case 'send_email':
            data = {
              ...action,
              user: timeline.user,
              contacts: timeline.contacts,
            };

            EmailHelper.sendEmail(data)
              .then(async (res) => {
                // Getting task exec status
                const errors = [];
                res.forEach((_res) => {
                  if (!_res.status) {
                    errors.push({
                      contact: _res.contact,
                      error: _res.error,
                    });
                  }
                });
                // Checking the same process tasks, if same doesn't exist, remove all tasks
                const anotherProcessTasks = await Task.find({
                  process: timeline.process,
                  status: 'active',
                  _id: { $nin: [timeline._id] },
                });
                if (anotherProcessTasks && anotherProcessTasks.length) {
                  timeline['status'] = 'completed';
                  // notification update or create
                  const notification = await Notification.findOne({
                    process: timeline.process,
                  });
                  if (notification) {
                    notification.deliver_status.failed = [
                      ...notification.deliver_status.failed,
                      ...errors,
                    ];
                    notification.save();
                  } else {
                    const newNotification = new Notification({
                      user: timeline.user,
                      criteria: 'bulk_email',
                      status: 'pending',
                      process: timeline.process,
                      deliver_status: {
                        total: action.contacts.length,
                        failed: errors,
                      },
                      detail: action,
                    });
                    newNotification.save();
                  }
                  if (timeline.exec_result && timeline.exec_result.failed) {
                    timeline.exec_result.failed = [
                      ...timeline.exec_result.failed,
                      ...errors,
                    ];
                  } else {
                    timeline.exec_result = {
                      failed: errors,
                    };
                  }
                  timeline.save();
                } else {
                  // Remove all same tasks
                  Task.deleteMany({ process: timeline.process }).catch(
                    (err) => {
                      console.log('Delete tasks error: ', err);
                    }
                  );
                  // Notification Update or Create for completed
                  const notification = await Notification.findOne({
                    process: timeline.process,
                  });
                  if (notification) {
                    notification.deliver_status.failed = [
                      ...notification.deliver_status.failed,
                      ...errors,
                    ];
                    notification.status = 'delivered';
                    notification.save();
                  } else {
                    const newNotification = new Notification({
                      user: timeline.user,
                      criteria: 'bulk_email',
                      status: 'delivered',
                      process: timeline.process,
                      deliver_status: {
                        total: action.contacts.length,
                        failed: errors,
                      },
                      detail: action,
                    });
                    newNotification.save();
                  }
                }
              })
              .catch((err) => {
                console.log('resolve error', err);
                timeline['status'] = 'error';
                timeline['updated_at'] = new Date();
                timeline.save().catch((err) => {
                  console.log('err', err);
                });
              });
            break;
          case 'bulk_sms': {
            const {
              message_sid,
              service,
              activities,
              activity
            } = timeline.action;
            TextHelper.getStatus(message_sid, service).then((res) => {
              if (res.status === 'delivered') {
                TextHelper.handleDeliveredText(
                  timeline.contact,
                  activities,
                  activity,
                  timeline.text
                );

                TimeLine.deleteOne({
                  _id: timeline.id,
                }).catch((err) => {
                  console.log('timeline remove err', err.message);
                });
              } else if (res.status === 'sent') {
                const beginning_time = moment(timeline.due_date).add(
                  3,
                  'minutes'
                );
                const now = moment();
                if (beginning_time.isBefore(now)) {
                  TextHelper.handleFailedText(
                    activities,
                    activity,
                    timeline.text,
                    3
                  );

                  const notification = new Notification({
                    user: timeline.user,
                    contact: timeline.contact,
                    message_sid,
                    activities,
                    criteria: 'bulk_sms',
                    status: 'sent',
                    description:
                      res.errorMessage ||
                      'Could`t get delivery result from carrier',
                    content: 'Failed texting material',
                  });

                  notification.save().catch((err) => {
                    console.log('notification save err', err.message);
                  });

                  TimeLine.deleteOne({
                    _id: timeline.id,
                  }).catch((err) => {
                    console.log('timeline remove err', err.message);
                  });
                }
              } else if (
                res.status === 'undelivered' ||
                res.status === 'failed'
              ) {
                TextHelper.handleFailedText(
                  activities,
                  activity,
                  timeline.text,
                  4
                );

                const notification = new Notification({
                  user: timeline.user,
                  contact: timeline.contact,
                  message_sid,
                  activities,
                  criteria: 'bulk_sms',
                  status: 'sent',
                  description: res.errorMessage,
                  content: 'Failed texting material',
                });

                notification.save().catch((err) => {
                  console.log('notification save err', err.message);
                });

                TimeLine.deleteOne({
                  _id: timeline.id,
                }).catch((err) => {
                  console.log('timeline remove err', err.message);
                });
              }
            });
            break;
          }
          case 'auto_follow_up2': {
            let follow_due_date;
            if (action.due_date) {
              follow_due_date = action.due_date;
            } else {
              const now = moment();
              now.set({ second: 0, millisecond: 0 });
              follow_due_date = now.add(action.due_duration, 'hours');
              follow_due_date.set({ second: 0, millisecond: 0 });
            }
            const followUp = new FollowUp({
              content: action.content,
              contact: timeline.contact,
              user: timeline.user,
              type: action.task_type,
              due_date: follow_due_date,
            });

            followUp
              .save()
              .then(async (_followup) => {
                const garbage = await Garbage.findOne({
                  user: timeline.user,
                }).catch((err) => {
                  console.log('err', err);
                });
                let reminder_before = 30;
                if (garbage) {
                  reminder_before = garbage.reminder_before;
                }
                const startdate = moment(_followup.due_date);
                const reminder_due_date = startdate.subtract(
                  reminder_before,
                  'mins'
                );

                const reminder = new Reminder({
                  contact: timeline.contact,
                  due_date: reminder_due_date,
                  type: 'follow_up',
                  user: timeline.user,
                  follow_up: _followup.id,
                });

                reminder.save().catch((err) => {
                  console.log('error', err);
                });

                let detail_content = 'added follow up';
                detail_content = ActivityHelper.automationLog(detail_content);
                const activity = new Activity({
                  content: detail_content,
                  contacts: _followup.contact,
                  user: timeline.user,
                  type: 'follow_ups',
                  follow_ups: _followup.id,
                });

                activity
                  .save()
                  .then((_activity) => {
                    timeline['status'] = 'completed';
                    timeline['updated_at'] = new Date();
                    timeline.save().catch((err) => {
                      console.log('err', err);
                    });
                    Contact.updateOne(
                      { _id: _followup.contact },
                      { $set: { last_activity: _activity.id } }
                    ).catch((err) => {
                      console.log('contact update err', err.message);
                    });
                  })
                  .catch((err) => {
                    console.log('follow error', err.message);
                  });

                TimeLine.updateMany(
                  {
                    contact: timeline.contact,
                    'action.ref_id': timeline.ref,
                  },
                  {
                    $set: { 'action.follow_up': _followup.id },
                  }
                )
                  .then(() => {
                    console.log('follow up updated');
                  })
                  .catch((err) => {
                    console.log('follow error', err.message);
                  });
              })
              .catch((err) => {
                timeline['status'] = 'error';
                timeline['updated_at'] = new Date();
                timeline.save().catch((err) => {
                  console.log('err', err.message);
                });
                console.log('follow error', err.message);
              });
            break;
          }
          case 'resend_email_video1':
            data = {
              user: timeline.user,
              content: action.content,
              subject: action.subject,
              activities: [action.activity],
              videos: [action.video],
              contacts: [timeline.contact],
            };

            EmailHelper.resendVideo(data).catch((err) => {
              console.log('email resend video err', err.message);
            });

            Task.deleteOne({
              _id: timeline.id,
            }).catch((err) => {
              console.log('timeline remove err', err.message);
            });
            break;
          case 'resend_text_video1':
            data = {
              user: timeline.user,
              content: action.content,
              subject: action.subject,
              activities: [action.activity],
              videos: [action.video],
              contacts: [timeline.contact],
            };
            TextHelper.resendVideo(data).catch((err) => {
              console.log('text resend video err', err.message);
            });

            Task.deleteOne({
              _id: timeline.id,
            }).catch((err) => {
              console.log('timeline remove err', err.message);
            });
            break;
          case 'resend_email_video2':
            data = {
              user: timeline.user,
              content: action.content,
              subject: action.subject,
              activities: [action.activity],
              videos: [action.video],
              contacts: [timeline.contact],
            };

            EmailHelper.resendVideo(data).catch((err) => {
              console.log('email resend video err', err.message);
            });

            Task.deleteOne({
              _id: timeline.id,
            }).catch((err) => {
              console.log('timeline remove err', err.message);
            });
            break;
          case 'resend_text_video2':
            data = {
              user: timeline.user,
              content: action.content,
              subject: action.subject,
              activities: [action.activity],
              videos: [action.video],
              contacts: [timeline.contact],
            };
            TextHelper.resendVideo(data).catch((err) => {
              console.log('text resend video err', err.message);
            });

            Task.deleteOne({
              _id: timeline.id,
            }).catch((err) => {
              console.log('timeline remove err', err.message);
            });
            break;
        }
      }
    }
  },
  function () {
    console.log('Task check Job finished.');
  },
  false,
  'US/Central'
);

task_check.start();
