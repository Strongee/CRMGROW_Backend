const moment = require('moment');
const mongoose = require('mongoose');
const TimeLine = require('../models/time_line');
const Automation = require('../models/automation');
const Contact = require('../models/contact');
const Note = require('../models/note');
const Activity = require('../models/activity');
const FollowUp = require('../models/follow_up');
const Reminder = require('../models/reminder');
const Garbage = require('../models/garbage');
const EmailHelper = require('../helpers/email');
const TextHelper = require('../helpers/text');
const ActivityHelper = require('../helpers/activity');

const create = async (req, res) => {
  const { currentUser } = req;
  const { contacts, automation_id } = req.body;
  const error = [];
  const _automation = await Automation.findOne({ _id: automation_id }).catch(
    (err) => {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        err: err.message || 'Automation found err',
      });
    }
  );

  if (_automation) {
    const { automations } = _automation;

    for (let i = 0; i < contacts.length; i++) {
      const old_timeline = await TimeLine.findOne({
        contact: contacts[i],
        automation: { $ne: null },
      });

      if (old_timeline) {
        const contact = await Contact.findOne({ _id: contacts[i] });
        error.push({
          contact: {
            first_name: contact.first_name,
            email: contact.email,
          },
          err: 'A contact has been already assigned automation',
        });
        continue;
      }
      for (let j = 0; j < automations.length; j++) {
        const automation = automations[j];
        let time_line;
        if (automation.status === 'active') {
          const { period } = automation;
          const now = moment();
          // let tens = parseInt(now.minutes() / 10)
          // now.set({ minute: tens*10, second: 0, millisecond: 0 })
          now.set({ second: 0, millisecond: 0 });
          const due_date = now.add(period, 'hours');
          due_date.set({ second: 0, millisecond: 0 });

          const _time_line = new TimeLine({
            ...automation,
            ref: automation.id,
            parent_ref: automation.parent,
            user: currentUser.id,
            contact: contacts[i],
            automation: automation_id,
            due_date,
            created_at: new Date(),
            updated_at: new Date(),
          });
          _time_line
            .save()
            .then(async (timeline) => {
              if (timeline.period === 0) {
                try {
                  runTimeline(timeline.id);
                  const data = {
                    contact: contacts[i],
                    ref: timeline.ref,
                  };
                  activeNext(data);
                } catch (err) {
                  console.log('err', err);
                }
              }
            })
            .catch((err) => {
              console.log('err', err);
            });
        } else {
          time_line = new TimeLine({
            ...automation,
            ref: automation.id,
            parent_ref: automation.parent,
            user: currentUser.id,
            contact: contacts[i],
            automation: automation_id,
            created_at: new Date(),
            updated_at: new Date(),
          });
          time_line.save().catch((err) => {
            console.log('err', err);
          });
        }
      }
    }
    if (error.length > 0) {
      return res.status(405).json({
        status: false,
        error,
      });
    }
    return res.send({
      status: true,
    });
  }
  res.status(400).json({
    status: false,
    err: 'Automation not found',
  });
};

const activeNext = async (data) => {
  const { contact, ref } = data;

  const timelines = await TimeLine.find({
    contact,
    status: 'pending',
    parent_ref: ref,
  });
  if (timelines) {
    for (let i = 0; i < timelines.length; i++) {
      const timeline = timelines[i];
      if (timeline.condition && timeline.condition.answer === true) {
        timeline.status = 'checking';
      } else {
        const { period } = timeline;
        const now = moment();
        now.set({ second: 0, millisecond: 0 });
        const due_date = now.add(period, 'hours');
        due_date.set({ second: 0, millisecond: 0 });
        timeline.status = 'active';
        timeline.due_date = due_date;
      }
      timeline.save().catch((err) => {
        console.log('err', err.message);
      });
    }
  }
};

const runTimeline = async (id) => {
  const timelines = await TimeLine.find({ _id: id }).catch((err) => {
    console.log('err', err);
  });
  for (let i = 0; i < timelines.length; i++) {
    const timeline = timelines[i];
    const { action } = timeline;
    let data;
    if (!action) {
      continue;
    }
    switch (action.type) {
      case 'follow_up': {
        let follow_due_date;
        if (action.due_date) {
          follow_due_date = action.due_date;
        } else {
          const now = moment();
          // let tens = parseInt(now.minutes() / 10)
          // now.set({ minute: tens*10, second: 0, millisecond: 0 })
          now.set({ second: 0, millisecond: 0 });
          follow_due_date = now.add(action.due_duration, 'hours');
          follow_due_date.set({ second: 0, millisecond: 0 });
        }
        const followUp = new FollowUp({
          content: action.content,
          contact: timeline.contact,
          user: timeline.user,
          type: 'follow_up',
          due_date: follow_due_date,
          updated_at: new Date(),
          created_at: new Date(),
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
              created_at: new Date(),
              updated_at: new Date(),
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
              created_at: new Date(),
              updated_at: new Date(),
            });

            activity
              .save()
              .then((_activity) => {
                timeline.status = 'completed';
                timeline.updated_at = new Date();
                timeline.save().catch((err) => {
                  console.log('err', err);
                });
                Contact.updateOne(
                  { _id: _followup.contact },
                  {
                    $set: { last_activity: _activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
              })
              .catch((err) => {
                console.log('follow error', err);
              });

            TimeLine.updateMany(
              {
                contact: timeline.contact,
                'action.ref_id': timeline.ref,
              },
              {
                $set: { 'action.follow_up': _followup.id },
              }
            ).catch((err) => {
              console.log('follow error', err.message);
            });
          })
          .catch((err) => {
            timeline.status = 'error';
            timeline.updated_at = new Date();
            timeline.save().catch((err) => {
              console.log('err', err);
            });
            console.log('follow error', err);
          });
        break;
      }
      case 'update_follow_up': {
        let follow_due_date;
        if (action.due_date) {
          follow_due_date = action.due_date;
        } else {
          const now = moment();
          now.set({ second: 0, millisecond: 0 });
          follow_due_date = now.add(action.due_duration, 'hours');
          follow_due_date.set({ second: 0, millisecond: 0 });
        }
        break;
      }
      case 'note': {
        const note = new Note({
          content: action.content,
          contact: timeline.contact,
          user: timeline.user,
          updated_at: new Date(),
          created_at: new Date(),
        });

        let detail_content = 'added note';
        detail_content = ActivityHelper.automationLog(detail_content);

        note
          .save()
          .then((_note) => {
            const activity = new Activity({
              content: detail_content,
              contacts: _note.contact,
              user: timeline.user,
              type: 'notes',
              notes: _note.id,
              created_at: new Date(),
              updated_at: new Date(),
            });

            activity.save().then((_activity) => {
              Contact.updateOne(
                { _id: _note.contact },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });
              timeline.status = 'completed';
              timeline.updated_at = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            });
          })
          .catch((err) => {
            console.log('err', err);
            timeline.status = 'error';
            timeline.updated_at = new Date();
            timeline.save().catch((err) => {
              console.log('err', err);
            });
          });
        break;
      }
      case 'email':
        data = {
          user: timeline.user,
          video: action.video,
          subject: action.subject,
          content: action.content,
          contacts: [timeline.contact],
        };
        EmailHelper.bulkEmail(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              timeline.status = 'completed';
              timeline.updated_at = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
              const activity_data = {
                activity: res[0].activity,
                contact: timeline.contact,
                parent_ref: timeline.ref,
              };
              setEmailTrackTimeline(activity_data);
            } else {
              timeline.status = 'error';
              timeline.updated_at = new Date();
              console.log('err', res[0].err);
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
        break;
      case 'send_text_video':
        data = {
          user: timeline.user,
          videos: [action.video],
          content: action.content,
          contacts: [timeline.contact],
        };
        TextHelper.bulkVideo(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              timeline.status = 'completed';
              timeline.updated_at = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              timeline.status = 'error';
              timeline.updated_at = new Date();
              console.log('err', res[0].err);
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
        break;
      case 'send_email_video':
        data = {
          user: timeline.user,
          content: action.content,
          subject: action.subject,
          videos: [action.video],
          contacts: [timeline.contact],
        };
        EmailHelper.bulkVideo(data)
          .then((res) => {
            console.log('res', res);
            if (res[0] && res[0].status === true) {
              timeline.status = 'completed';
              timeline.updated_at = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              timeline.status = 'error';
              timeline.updated_at = new Date();
              console.log('err', res[0].err);
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
        break;
      case 'send_text_pdf':
        data = {
          user: timeline.user,
          content: action.content,
          pdfs: [action.pdf],
          contacts: [timeline.contact],
        };
        TextHelper.bulkPDF(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              timeline['status'] = 'completed';
              timeline['updated_at'] = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              timeline['status'] = 'error';
              timeline['updated_at'] = new Date();
              console.log('err', res[0].err);
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
        break;
      case 'send_email_pdf':
        data = {
          user: timeline.user,
          content: action.content,
          subject: action.subject,
          pdfs: [action.pdf],
          contacts: [timeline.contact],
        };
        EmailHelper.bulkPDF(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              timeline['status'] = 'completed';
              timeline['updated_at'] = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              timeline['status'] = 'error';
              timeline['updated_at'] = new Date();
              console.log('err', res[0].err);
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
        break;
      case 'send_text_image':
        data = {
          user: timeline.user,
          content: action.content,
          images: [action.image],
          contacts: [timeline.contact],
        };
        TextHelper.bulkImage(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              timeline.status = 'completed';
              timeline.updated_at = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              timeline.status = 'error';
              timeline.updated_at = new Date();
              console.log('err', res[0].err);
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
        break;
      case 'send_email_image':
        data = {
          user: timeline.user,
          content: action.content,
          images: [action.image],
          subject: action.subject,
          contacts: [timeline.contact],
        };
        EmailHelper.bulkImage(data)
          .then((res) => {
            if (res[0] && res[0].status === true) {
              timeline.status = 'completed';
              timeline.updated_at = new Date();
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            } else {
              timeline.status = 'error';
              timeline.updated_at = new Date();
              console.log('err', res[0].err);
              timeline.save().catch((err) => {
                console.log('err', err);
              });
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
        break;
      case 'update_contact': {
        switch (action.command) {
          case 'update_label':
            Contact.updateOne(
              {
                _id: timeline.contact,
              },
              {
                $set: { label: mongoose.Types.ObjectId(action.content) },
              }
            ).catch((err) => {
              console.log('label set err', err.message);
            });
            break;
          case 'push_tag': {
            const tags = action.content.map((tag) => tag.value);
            Contact.updateOne(
              {
                _id: timeline.contact,
              },
              {
                $push: { tags: { $each: tags } },
              }
            ).catch((err) => {
              console.log('tag update err', err.message);
            });
            break;
          }
          case 'pull_tag': {
            const tags = action.content.map((tag) => tag.value);
            Contact.updateOne(
              {
                _id: timeline.contact,
              },
              {
                $pull: { tags: { $in: tags } },
              }
            ).catch((err) => {
              console.log('tag update err', err.message);
            });
            break;
          }
        }
        timeline['status'] = 'completed';
        timeline['updated_at'] = new Date();
        timeline.save().catch((err) => {
          console.log('time line err', err.message);
        });
        break;
      }
    }
  }
};

const cancel = (req, res) => {
  const { contact } = req.params;

  TimeLine.deleteMany({
    contact,
    automation: { $ne: null },
  }).then(
    (data) => {
      return res.send({
        status: true,
      });
    },
    (err) => {
      return res.status(500).send({
        status: false,
        error: err,
      });
    }
  );
};

const recreate = async (req, res) => {
  const { currentUser } = req;
  const { contact, automation_id } = req.body;
  await TimeLine.deleteMany({
    contact,
    automation: { $ne: null },
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err,
    });
  });

  const _automation = await Automation.findOne({ _id: automation_id }).catch(
    (err) => {
      console.log('err', err);
      res.status(400).json({
        status: false,
        err: err.message || 'Automation found err',
      });
    }
  );

  if (_automation) {
    const { automations } = _automation;
    for (let i = 0; i < automations.length; i++) {
      const automation = automations[i];
      let time_line;
      if (automation.status === 'active') {
        const { period } = automation;
        const now = moment();
        const due_date = now.add(period, 'hours');
        due_date.set({ second: 0, millisecond: 0 });
        const _time_line = new TimeLine({
          ...automation,
          ref: automation.id,
          parent_ref: automation.parent,
          user: currentUser.id,
          contact,
          automation: automation_id,
          due_date,
          created_at: new Date(),
          updated_at: new Date(),
        });
        _time_line
          .save()
          .then((timeline) => {
            if (timeline.period === 0) {
              try {
                runTimeline(timeline.id);
                const data = {
                  contact,
                  ref: timeline.ref,
                };
                activeNext(data);
              } catch (err) {
                console.log('err', err);
              }
            }
          })
          .catch((err) => {
            console.log('err', err);
          });
      } else {
        time_line = new TimeLine({
          ...automation,
          ref: automation.id,
          parent_ref: automation.parent,
          user: currentUser.id,
          contact,
          automation: automation_id,
          created_at: new Date(),
          updated_at: new Date(),
        });
        time_line.save().catch((err) => {
          console.log('err', err);
        });
      }
    }
    return res.send({
      status: true,
    });
  }
  res.status(400).json({
    status: false,
    err: 'Automation not found',
  });
};

const disableNext = async (id) => {
  let timeline = await TimeLine.findOne({ _id: id }).catch((err) => {
    console.log('err', err);
  });
  if (timeline) {
    timeline.status = 'disabled';
    timeline.updated_at = new Date();
    timeline.save().catch((err) => {
      console.log('err', err);
    });
    let timelines;
    do {
      timelines = await TimeLine.find({
        parent_ref: timeline.ref,
        contact: timeline.contact,
        status: 'pending',
      });
      if (timelines.length === 0) {
        timeline = await TimeLine.findOne({
          ref: timeline.parent_ref,
          contact: timeline.contact,
          status: 'disabled',
        });
      } else {
        timeline = timelines[0];
        timeline.status = 'disabled';
        timeline.updated_at = new Date();
        timeline.save().catch((err) => {
          console.log('err', err.message);
        });
      }
    } while (timelines.length > 0 || timeline);
  }
};

const activeTimeline = async (id) => {
  const timeline = await TimeLine.findOne({ _id: id }).catch((err) => {
    console.log('err', err);
  });

  if (timeline) {
    const now = moment();
    const { period } = timeline;
    now.set({ second: 0, millisecond: 0 });
    const due_date = now.add(period, 'hours');
    due_date.set({ second: 0, millisecond: 0 });
    timeline.status = 'active';
    timeline.due_date = due_date;
    timeline.save().catch((err) => {
      console.log('err', err.message);
    });
  }
};

const setEmailTrackTimeline = async (data) => {
  const { activity, contact, parent_ref } = data;
  TimeLine.updateMany(
    {
      contact,
      parent_ref,
      'condition.case': 'opened_email',
    },
    {
      $set: { opened_email: activity },
    }
  ).catch((err) => {
    console.log('err', err);
  });
};

module.exports = {
  create,
  recreate,
  activeNext,
  disableNext,
  runTimeline,
  activeTimeline,
  setEmailTrackTimeline,
  cancel,
};
