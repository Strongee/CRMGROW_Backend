const { validationResult } = require('express-validator/check');
const moment = require('moment-timezone');
const FollowUp = require('../models/follow_up');
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const Reminder = require('../models/reminder');
const Garbage = require('../models/garbage');
const User = require('../models/user');
const ActivityHelper = require('../helpers/activity');
const system_settings = require('../config/system_settings');

const get = async (req, res) => {
  const { currentUser } = req;
  const _follow_up = await FollowUp.find({
    user: currentUser.id,
    status: 0,
  }).sort({ due_date: -1 });
  const data = [];

  for (let i = 0; i < _follow_up.length; i++) {
    const _contact = await Contact.findOne({ _id: _follow_up[i].contact });
    const myJSON = JSON.stringify(_follow_up[i]);
    const follow_up = JSON.parse(myJSON);
    delete follow_up.contact;
    follow_up.contact = _contact;
    data.push(follow_up);
  }

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'FollowUp doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  let reminder_before = 30;
  if (garbage) {
    reminder_before = garbage.reminder_before;
  }

  const followUp = new FollowUp({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  followUp
    .save()
    .then((_followup) => {
      const startdate = moment(_followup.due_date);
      const due_date = startdate.subtract(reminder_before, 'minutes');
      const reminder = new Reminder({
        contact: _followup.contact,
        due_date,
        type: 'follow_up',
        user: currentUser.id,
        follow_up: _followup.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      reminder.save().catch((err) => {
        console.log('error', err);
      });

      let detail_content = 'added follow up';
      if (req.guest_loggin) {
        detail_content = ActivityHelper.assistantLog(detail_content);
      }
      const activity = new Activity({
        content: detail_content,
        contacts: _followup.contact,
        user: currentUser.id,
        type: 'follow_ups',
        follow_ups: _followup.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity
        .save()
        .then((_activity) => {
          Contact.updateOne(
            { _id: _followup.contact },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
          const myJSON = JSON.stringify(_followup);
          const data = JSON.parse(myJSON);
          data.activity = _activity;
          return res.send({
            status: true,
            data,
          });
        })
        .catch((e) => {
          console.log('follow error', e);
          return res.status().send({
            status: false,
            error: e,
          });
        });
    })
    .catch((e) => {
      console.log('follow error', e);
      return res.status(500).send({
        status: false,
        error: e.message,
      });
    });
};

const edit = async (req, res) => {
  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  let reminder_before = 30;
  if (garbage) {
    reminder_before = garbage.reminder_before;
  }

  const editData = req.body;

  if (req.body.due_date || req.body.contact) {
    Reminder.findOne({ follow_up: req.params.id })
      .then((_reminder) => {
        if (req.body.due_date) {
          const startdate = moment(req.body.due_date);
          const due_date = startdate.subtract(reminder_before, 'minutes');
          _reminder['due_date'] = due_date;
        }
        if (req.body.contact) {
          _reminder['contact'] = req.body.contact;
        }
        _reminder.save().catch((err) => {
          console.log('err', err);
        });
      })
      .catch((err) => {
        console.log('err', err);
      });
  }

  const follow_up = await FollowUp.findOne({ _id: req.params.id }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  for (const key in editData) {
    follow_up[key] = editData[key];
  }

  follow_up['updated_at'] = new Date();
  follow_up
    .save()
    .then((_follow_up) => {
      let detail_content = 'updated follow up';
      if (req.guest_loggin) {
        detail_content = ActivityHelper.assistantLog(detail_content);
      }

      const activity = new Activity({
        content: detail_content,
        contacts: req.body.contact,
        user: currentUser.id,
        type: 'follow_ups',
        follow_ups: _follow_up.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity
        .save()
        .then((_activity) => {
          Contact.updateOne(
            { _id: req.body.contact },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('activity save err', err.message);
          });
          const myJSON = JSON.stringify(follow_up);
          const data = JSON.parse(myJSON);
          data.activity = _activity;
          return res.send({
            status: true,
            data,
          });
        })
        .catch((e) => {
          console.log('follow error', e);
          return res.status(500).send({
            status: false,
            error: e.message,
          });
        });
    })
    .catch((err) => {
      console.log('err', err);
    });
};

const completed = async (req, res) => {
  const { currentUser } = req;
  const { follow_up } = req.body;
  if (follow_up) {
    let detail_content = 'completed follow up';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    try {
      const _follow_up = await FollowUp.findOne({ _id: follow_up }).catch(
        (err) => {
          console.log('err', err);
        }
      );

      _follow_up.status = 1;
      _follow_up.save().catch((err) => {
        console.log('err', err);
      });

      Reminder.deleteOne({
        follow_up,
      }).catch((err) => {
        console.log('err', err);
      });

      const activity = new Activity({
        content: detail_content,
        contacts: _follow_up.contact,
        user: currentUser.id,
        type: 'follow_ups',
        follow_ups: follow_up,
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity
        .save()
        .then((_activity) => {
          Contact.updateOne(
            { _id: _follow_up.contact },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
          const myJSON = JSON.stringify(_follow_up);
          const data = JSON.parse(myJSON);
          data.activity = _activity;
          return res.send({
            status: true,
            data,
          });
        })
        .catch((e) => {
          console.log('follow error', e);
          return res.status(400).send({
            status: false,
            error: e,
          });
        });
    } catch (err) {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    }
  } else {
    console.log('FollowUp doesn`t exist');
    return res.status(400).json({
      status: false,
      error: 'FollowUp doesn`t exist',
    });
  }
};

const getByDate = async (req, res) => {
  const { currentUser } = req;

  // TODO: query condition should be defined in route
  // TODO: limit access to users
  const allowed_queries = [
    'overdue',
    'today',
    'tomorrow',
    'next_week',
    'next_month',
    'future',
  ];
  const query = { ...req.query };
  const cquery = { ...query };
  const due_date = query['due_date'];
  // const time_zone = currentUser.time_zone;
  const time_zone = currentUser.time_zone_info
    ? JSON.parse(currentUser.time_zone_info).tz_name
    : system_settings.TIME_ZONE;

  // Check valid queries
  if (!allowed_queries.includes(due_date)) {
    // Other queries
    console.error('Query not allowed:', cquery);
    return res.status(400).send({
      status: false,
      error: {
        msg: 'Query not allowed',
        data: cquery,
      },
    });
  }

  switch (due_date) {
    case 'overdue': {
      // const current_time = moment().utcOffset(time_zone).startOf('day');
      const current_time = moment().tz(time_zone).startOf('day');

      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $lt: current_time },
        contact: { $ne: null },
      }).populate('contact');

      res.send({
        status: true,
        data: _follow_up,
      });
      break;
    }
    case 'today': {
      const start = moment().tz(time_zone).startOf('day'); // set to 12:00 am today
      const end = moment().tz(time_zone).endOf('day'); // set to 23:59 pm today
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: start, $lt: end },
        contact: { $ne: null },
      }).populate('contact');

      res.send({
        status: true,
        data: _follow_up,
      });
      break;
    }
    case 'tomorrow': {
      const today_start = moment().tz(time_zone).startOf('day'); // set to 12:00 am today
      const today_end = moment().tz(time_zone).endOf('day'); // set to 23:59 pm today
      const tomorrow_start = today_start.add(1, 'day');
      const tomorrow_end = today_end.add(1, 'day');
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: tomorrow_start, $lt: tomorrow_end },
        contact: { $ne: null },
      }).populate('contact');

      res.send({
        status: true,
        data: _follow_up,
      });
      break;
    }
    case 'next_week': {
      const next_week_start = moment()
        .tz(time_zone)
        .add(2, 'day')
        .startOf('day');
      const next_week_end = moment().tz(time_zone).add(7, 'days').endOf('day');
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: next_week_start, $lt: next_week_end },
        contact: { $ne: null },
      });

      res.send({
        status: true,
        data: _follow_up,
      });
      break;
    }
    case 'next_month': {
      const start_month = moment().tz(time_zone).add(8, 'day').startOf('day');
      const end_month = moment().tz(time_zone).add(30, 'days').endOf('day');
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: start_month, $lt: end_month },
        contact: { $ne: null },
      });

      res.send({
        status: true,
        data: _follow_up,
      });
      break;
    }
    case 'future': {
      const start_future = moment().tz(time_zone).add(8, 'day').startOf('day');
      const _follow_up = await FollowUp.find({
        user: currentUser.id,
        status: 0,
        due_date: { $gte: start_future },
        contact: { $ne: null },
      });

      res.send({
        status: true,
        data: _follow_up,
      });
      break;
    }
    default:
  }
};

const updateArchived = async (req, res) => {
  const { follow_ups } = req.body;
  if (follow_ups) {
    try {
      for (let i = 0; i < follow_ups.length; i++) {
        const follow_up = follow_ups[i];
        FollowUp.deleteOne({ _id: follow_up }).catch((err) => {
          console.log('follow up delete err', err.message);
        });
        Reminder.deleteOne({
          type: 'follow_up',
          follow_up: follow_up.id,
        }).catch((err) => {
          console.log('reminder up delete err', err.message);
        });
      }
      res.send({
        status: true,
      });
    } catch (err) {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'FollowUp doesn`t exist',
    });
  }
};

const updateChecked = async (req, res) => {
  const { currentUser } = req;
  const { follow_ups } = req.body;
  if (follow_ups) {
    let detail_content = 'completed follow up';
    if (req.guest_loggin) {
      detail_content = ActivityHelper.assistantLog(detail_content);
    }

    try {
      for (let i = 0; i < follow_ups.length; i++) {
        const follow_up = follow_ups[i];
        const _follow_up = await FollowUp.findOne({ _id: follow_up }).catch(
          (err) => {
            console.log('err', err);
          }
        );

        _follow_up.status = 1;
        _follow_up.save().catch((err) => {
          console.log('err', err);
        });

        Reminder.deleteOne({
          follow_up,
        }).catch((err) => {
          console.log('err', err);
        });

        const activity = new Activity({
          content: detail_content,
          contacts: _follow_up.contact,
          user: currentUser.id,
          type: 'follow_ups',
          follow_ups: follow_up,
          created_at: new Date(),
          updated_at: new Date(),
        });

        activity
          .save()
          .then((_activity) => {
            Contact.updateOne(
              { _id: _follow_up.contact },
              {
                $set: { last_activity: _activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
          })
          .catch((e) => {
            console.log('follow error', e);
            return res.status(400).send({
              status: false,
              error: e,
            });
          });
      }
      return res.send({
        status: true,
      });
    } catch (err) {
      console.log('err', err);
      return res.status(400).json({
        status: false,
        error: err,
      });
    }
  } else {
    console.log('FollowUp doesn`t exist');
    return res.status(400).json({
      status: false,
      error: 'FollowUp doesn`t exist',
    });
  }
};

const bulkUpdate = async (req, res) => {
  const { ids, content, due_date, type } = req.body;

  const { currentUser } = req;
  const garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  let reminder_before = 30;
  if (garbage) {
    reminder_before = garbage.reminder_before;
  }

  if (req.body.due_date) {
    const startdate = moment(req.body.due_date);
    const reminder_due_date = startdate.subtract(reminder_before, 'minutes');

    Reminder.updateMany(
      { follow_up: { $in: ids } },
      { $set: { due_date: reminder_due_date } }
    ).catch((err) => {
      console.log('err', err);
    });
  }

  if (ids && ids.length) {
    try {
      const query = {};
      if (content) {
        query['content'] = content;
      }
      if (type) {
        query['type'] = type;
      }
      if (due_date) {
        query['due_date'] = due_date;
      }
      FollowUp.updateMany({ _id: { $in: ids } }, { $set: query })
        .then(async (data) => {
          let detail_content = 'updated follow up';
          if (req.guest_loggin) {
            detail_content = ActivityHelper.assistantLog(detail_content);
          }
          const follow_ups = await FollowUp.find({ _id: { $in: ids } });
          for (let i = 0; i < follow_ups.length; i++) {
            const follow_up = follow_ups[i];
            const activity = new Activity({
              content: detail_content,
              contacts: follow_up.contact,
              user: currentUser.id,
              type: 'follow_ups',
              follow_ups: follow_up.id,
            });

            activity
              .save()
              .then((_activity) => {
                Contact.updateOne(
                  { _id: follow_up.contact },
                  {
                    $set: { last_activity: _activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
              })
              .catch((err) => {
                console.log('follow bulk update error', err.message);
              });
          }
          res.send({
            status: true,
            data,
          });
        })
        .catch((err) => {
          console.log('err', err);
          res.send({
            status: false,
            error: err,
          });
        });
    } catch (err) {
      return res.status(400).json({
        status: false,
        error: err,
      });
    }
  } else {
    return res.status(400).json({
      status: false,
      error: 'No selected Follow up(s)',
    });
  }
};

const bulkCreate = async (req, res) => {
  const { currentUser } = req;
  const {
    contacts,
    content,
    due_date,
    type,
    set_recurrence,
    recurrence_mode,
  } = req.body;

  const garbage = await Garbage.findOne({ user: currentUser.id }).catch(
    (err) => {
      console.log('err', err);
    }
  );

  let reminder_before = 30;
  if (garbage) {
    reminder_before = garbage.reminder_before;
  }

  let detail_content = 'added follow up';
  if (req.guest_loggin) {
    detail_content = ActivityHelper.assistantLog(detail_content);
  }

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const followUp = new FollowUp({
      type,
      content,
      due_date,
      contact,
      set_recurrence,
      recurrence_mode,
      user: currentUser.id,
      updated_at: new Date(),
      created_at: new Date(),
    });

    followUp
      .save()
      .then((_followup) => {
        const startdate = moment(_followup.due_date);
        const due_date = startdate.subtract(reminder_before, 'minutes');
        const reminder = new Reminder({
          contact: _followup.contact,
          due_date,
          type: 'follow_up',
          user: currentUser.id,
          follow_up: _followup.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        reminder.save().catch((err) => {
          console.log('error', err);
        });

        const activity = new Activity({
          content: detail_content,
          contacts: _followup.contact,
          user: currentUser.id,
          type: 'follow_ups',
          follow_ups: _followup.id,
          created_at: new Date(),
          updated_at: new Date(),
        });

        activity
          .save()
          .then((_activity) => {
            Contact.updateOne(
              { _id: _followup.contact },
              {
                $set: { last_activity: _activity.id },
              }
            ).catch((err) => {
              console.log('err', err);
            });
            const myJSON = JSON.stringify(_followup);
            const data = JSON.parse(myJSON);
            data.activity = _activity;
          })
          .catch((e) => {
            console.log('follow error', e);
            return res.status().send({
              status: false,
              error: e,
            });
          });
      })
      .catch((e) => {
        console.log('follow error', e);
        return res.status().send({
          status: false,
          error: e,
        });
      });
  }
  return res.send({
    status: true,
  });
};

const load = async (req, res) => {
  const { currentUser } = req;
  const { skip, pageSize, searchOption } = req.body;
  const {
    types,
    status,
    contact,
    labels,
    start_date,
    end_date,
    str,
    sortDir,
  } = searchOption;

  const query = { user: currentUser._id };
  types && types.length ? (query.type = { $in: types }) : false;

  if (typeof status !== 'undefined') {
    query.status = status;
  }
  contact ? (query.contact = contact) : false;
  if (start_date) {
    query.due_date = { $gte: start_date };
  }
  if (end_date) {
    if (query.due_date) {
      query.due_date.$lt = end_date;
    } else {
      query.due_date = { $lte: end_date };
    }
  }
  if (str) {
    query.content = { $regex: '.*' + str + '.*' };
  }

  if (labels && labels.length) {
    const contacts = await Contact.find({
      user: currentUser._id,
      label: { $in: labels },
    }).select('_id');
    const contact_ids = contacts.map((e) => e._id);
    query.contact = { $in: contact_ids };
  }
  const count = await FollowUp.countDocuments(query);
  const _follow_ups = await FollowUp.find(query)
    .sort({ due_date: sortDir })
    .skip(skip)
    .limit(pageSize)
    .populate({ path: 'contact' });

  return res.send({
    status: true,
    data: {
      count,
      tasks: _follow_ups,
    },
  });
};

const selectAll = async (req, res) => {
  const { currentUser } = req;
  const {
    types,
    status,
    contact,
    labels,
    start_date,
    end_date,
    str,
    sortDir,
  } = req.body;

  const query = { user: currentUser._id };
  types && types.length ? (query.type = { $in: types }) : false;
  if (typeof status !== 'undefined') {
    query.status = status;
  }
  contact ? (query.contact = contact) : false;
  if (start_date) {
    query.due_date = { $gte: start_date };
  }
  if (end_date) {
    if (query.due_date) {
      query.due_date.$lt = end_date;
    } else {
      query.due_date = { $lte: end_date };
    }
  }
  if (str) {
    query.content = { $regex: '.*' + str + '.*' };
  }
  if (labels && labels.length) {
    const contacts = await Contact.find({
      user: currentUser._id,
      label: { $in: labels },
    }).select('_id');
    const contact_ids = contacts.map((e) => e._id);
    query.contact = { $in: contact_ids };
  }

  const _follow_ups = await FollowUp.find(query).select({ _id: 1, status: 1 });
  const selected_follows = _follow_ups.map((e) => ({
    _id: e._id,
    status: e.status,
  }));

  return res.send({
    status: true,
    data: selected_follows,
  });
};

module.exports = {
  get,
  load,
  create,
  edit,
  completed,
  getByDate,
  selectAll,
  updateChecked,
  updateArchived,
  bulkUpdate,
  bulkCreate,
};
