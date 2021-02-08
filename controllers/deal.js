const mongoose = require('mongoose');
const moment = require('moment');
const { google } = require('googleapis');
const AWS = require('aws-sdk');

const User = require('../models/user');
const Deal = require('../models/deal');
const DealStage = require('../models/deal_stage');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Note = require('../models/note');
const FollowUp = require('../models/follow_up');
const ActivityHelper = require('../helpers/activity');
const Email = require('../models/email');
const Appointment = require('../models/appointment');
const TeamCall = require('../models/team_call');
const Notification = require('../models/notification');
const {
  addGoogleCalendarById,
  addOutlookCalendarById,
} = require('./appointment');
const EmailHelper = require('../helpers/email');
const api = require('../config/api');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const { getAvatarName } = require('../helpers/utility');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

const getAll = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  const data = await Deal.find({
    user: currentUser.id,
    contacts: { $in: contacts },
  });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Deal doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  const deal = new Deal({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  deal
    .save()
    .then((_deal) => {
      let detail_content = 'added deal';
      if (req.guest_loggin) {
        detail_content = ActivityHelper.assistantLog(detail_content);
      }

      DealStage.updateOne(
        {
          _id: req.body.deal_stage,
        },
        {
          $push: { deals: _deal._id },
        }
      ).catch((err) => {
        console.log('error', err.message);
      });

      for (let i = 0; i < contacts.length; i++) {
        const activity = new Activity({
          content: detail_content,
          contacts: contacts[i],
          user: currentUser.id,
          type: 'deals',
          deals: _deal.id,
        });

        activity.save().catch((err) => {
          console.log('activity save err', err.message);
        });
        Contact.updateOne(
          { _id: contacts[i] },
          { $set: { last_activity: activity.id } }
        ).catch((err) => {
          console.log('err', err);
        });
      }

      const myJSON = JSON.stringify(_deal);
      const data = JSON.parse(myJSON);
      data.deal_stage = req.body.deal_stage;

      return res.send({
        status: true,
        data: _deal,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const moveDeal = async (req, res) => {
  const { deal_id, position } = req.body;
  let { deal_stage_id } = req.body;

  const deal = await Deal.findOne({ _id: deal_id }).catch((err) => {
    console.log('deal found error', err.message);
    return res.status(500).send(err.message || 'Deal found error');
  });

  try {
    await DealStage.updateOne(
      { _id: deal.deal_stage },
      {
        $pull: {
          deals: { $in: [mongoose.Types.ObjectId(deal_id)] },
        },
      },
      { new: true }
    ).catch((err) => {
      console.log('source deal stage update error', err.message);
      throw err.message || 'Source deal stage update error';
    });

    await Deal.updateOne(
      { _id: deal_id },
      {
        $set: {
          deal_stage: deal_stage_id,
        },
      }
    ).catch((err) => {
      console.log('deal update error', err.message);
      throw err.message || 'deal update error';
    });

    if (!deal_stage_id) {
      deal_stage_id = deal.deal_stage;
    }
    await DealStage.updateOne(
      { _id: deal_stage_id },
      {
        $push: {
          deals: {
            $each: [deal_id],
            $position: position,
          },
        },
      }
    ).catch((err) => {
      console.log('destination deal stage update error', err.message);
      throw err.message || 'Destination deal stage update error';
    });
    return res.send();
  } catch (error) {
    return res.status(500).send(error);
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;

  const deal = await Deal.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('deal find err', err.message);
  });

  if (!deal) {
    return res.status(400).json({
      status: false,
      error: 'Permission invalid',
    });
  }

  Deal.deleteOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('remove deal', err.message);
  });

  DealStage.updateOne(
    {
      _id: deal.deal_stage,
    },
    {
      $pull: {
        deals: { $in: [mongoose.Types.ObjectId(req.params.id)] },
      },
    }
  ).catch((err) => {
    console.log('remove deal', err.message);
  });

  // TODO: Relative Notes, Tasks, Emails, Appointments remove

  return res.send({
    status: true,
  });
};

const edit = async (req, res) => {
  const { currentUser } = req;
  const body = req.body;

  const currentDeal = await Deal.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || JSON.stringify(err),
    });
  });

  if (!currentDeal) {
    return res.status(400).send({
      status: false,
      error: 'Not found current deal.',
    });
  }

  Deal.updateOne(
    {
      _id: req.params.id,
      user: currentUser.id,
    },
    { $set: body }
  )
    .then(async () => {
      if (currentDeal.deal_stage !== body.deal_stage) {
        console.log(
          'current stage',
          'new-stage',
          currentDeal.deal_stage,
          body.deal_stage
        );
        await DealStage.updateOne(
          { _id: currentDeal.deal_stage },
          { $pull: { deals: currentDeal._id } }
        ).catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message || JSON.stringify(err),
          });
        });
        await DealStage.updateOne(
          { _id: body.deal_stage },
          { $addToSet: { deals: currentDeal._id } }
        ).catch((err) => {
          return res.status(500).send({
            status: false,
            error: err.message || JSON.stringify(err),
          });
        });
        return res.send({
          status: true,
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
        error: err.message,
      });
    });
};

const updateContact = (req, res) => {
  const { currentUser } = req;
  const { action, contacts } = req.body;

  let query;
  if (action === 'add') {
    query = { $addToSet: { contacts: { $each: contacts } } };
  } else if (action === 'remove') {
    query = { $pull: { contacts: { $in: contacts } } };
  }

  Deal.updateOne(
    {
      _id: req.params.id,
      user: currentUser.id,
    },
    query
  )
    .then((result) => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || JSON.stringify(err),
      });
    });
};

const getDetail = (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;

  Deal.findOne({ _id: id, user: currentUser._id })
    .then(async (_deal) => {
      const _contacts = await Contact.find({ _id: { $in: _deal['contacts'] } });
      return res.send({
        status: true,
        data: {
          main: _deal,
          contacts: _contacts,
          activities: [],
        },
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const getActivity = async (req, res) => {
  const { currentUser } = req;

  const activity_list = await Activity.find({
    user: currentUser.id,
    deals: req.body.deal,
  })
    .sort({ updated_at: 1 })
    .catch((err) => {
      console.log('activity get err', err.message);
    });

  const activity_detail_list = [];

  for (let i = 0; i < activity_list.length; i++) {
    const activity_detail = await Activity.aggregate([
      {
        $lookup: {
          from: activity_list[i].type,
          localField: activity_list[i].type,
          foreignField: '_id',
          as: 'activity_detail',
        },
      },
      {
        $match: { _id: activity_list[i]._id },
      },
    ]);

    activity_detail_list.push(activity_detail[0]);
  }

  return res.send({
    status: true,
    data: activity_detail_list,
  });
};

const getNotes = async (req, res) => {
  const { currentUser } = req;
  const notes = await Note.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: notes,
  });
};

const createNote = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  const note = new Note({
    content: req.body.content,
    deal: req.body.deal,
    user: currentUser.id,
  });

  note.save().catch((err) => {
    console.log('deal note create err', err.message);
  });

  const content = 'added note';
  const activity = new Activity({
    user: currentUser.id,
    content,
    notes: note.id,
    type: 'notes',
    deals: req.body.deal,
  });

  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  for (let i = 0; i < contacts.length; i++) {
    const contact_note = new Note({
      contact: contacts[i],
      has_shared: true,
      shared_note: note.id,
      content: req.body.content,
      user: currentUser.id,
    });

    contact_note.save().catch((err) => {
      console.log('note save err', err.message);
    });

    const note_activity = new Activity({
      content,
      contacts: contacts[i],
      type: 'notes',
      notes: contact_note.id,
      user: currentUser.id,
    });

    note_activity.save().catch((err) => {
      console.log('note activity err', err.message);
    });
  }
  return res.send({
    status: true,
  });
};

const createFollowUp = async (req, res) => {
  const { currentUser } = req;
  const { deal, type, content, due_date } = req.body;
  const followup = new FollowUp({
    user: currentUser.id,
    deal,
    type,
    content,
    due_date,
  });

  followup.save().catch((err) => {
    console.log('new follow up save err', err.message);
  });

  const activity_content = 'added follow up';
  const activity = new Activity({
    content: activity_content,
    type: 'follow_ups',
    follow_ups: followup.id,
    deals: req.body.deal,
    user: currentUser.id,
  });

  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  const { contacts } = req.body;
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    const new_followup = new FollowUp({
      has_shared: true,
      shared_followup: followup.id,
      contact,
      content,
      due_date,
      type,
      user: currentUser.id,
    });

    new_followup.save().catch((err) => {
      console.log('new follow up save err', err.message);
    });

    const new_activity = new Activity({
      content: activity_content,
      contact,
      user: currentUser.id,
      type: 'follow_ups',
      follow_ups: new_followup.id,
    });
    new_activity.save().catch((err) => {
      console.log('activity save err', err.message);
    });
  }

  return res.send({
    status: true,
  });
};

const sendEmail = async (req, res) => {
  const { currentUser } = req;
  const { subject, content, cc, bcc, deal } = req.body;

  const email = new Email({
    user: currentUser.id,
    subject,
    content,
    cc,
    bcc,
    deal,
  });

  email.save().catch((err) => {
    console.log('new email save err', err.message);
  });

  const activity_content = 'sent email';

  const activity = new Activity({
    user: currentUser.id,
    content: activity_content,
    deals: deal,
    type: 'emails',
    emails: email.id,
  });

  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  EmailHelper.sendEmail(req.body).catch((err) => {
    console.log('email send error');
  });
};

const getEmails = async (req, res) => {
  const { currentUser } = req;
  const emails = await Email.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: emails,
  });
};

const getAppointments = async (req, res) => {
  const { currentUser } = req;
  const appointments = await Appointment.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: appointments,
  });
};

const getTeamCalls = async (req, res) => {
  const { currentUser } = req;
  const team_calls = await TeamCall.find({
    user: currentUser.id,
    deal: req.body.deal,
  });

  return res.status({
    status: true,
    data: team_calls,
  });
};

const createAppointment = async (req, res) => {
  const { currentUser } = req;
  const { contacts } = req.body;

  let event_id;

  if (currentUser.calendar_connected) {
    const _appointment = req.body;
    const { connected_email } = req.body;

    const calendar_list = currentUser.calendar_list;
    let calendar;
    calendar_list.some((_calendar) => {
      if (_calendar.connected_email === connected_email) {
        calendar = _calendar;
      }
    });

    if (!calendar) {
      return res.status(400).json({
        status: false,
        error: 'Invalid calendar',
      });
    }

    if (calendar.connected_calendar_type === 'outlook') {
      event_id = addOutlookCalendarById(currentUser, _appointment, calendar);
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      const token = JSON.parse(calendar.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });
      event_id = await addGoogleCalendarById(
        oauth2Client,
        currentUser,
        _appointment
      );
    }

    const appointment = new Appointment({
      ...req.body,
      event_id,
    });

    appointment.save().catch((err) => {
      console.log('deal appointment create err', err.message);
    });

    const content = 'added appointment';
    const activity = new Activity({
      user: currentUser.id,
      content,
      type: 'appointments',
      appointments: appointment.id,
      deals: req.body.deal,
    });

    activity.save().catch((err) => {
      console.log('activity save err', err.message);
    });

    for (let i = 0; i < contacts.length; i++) {
      const contact_appointment = new Appointment({
        ...req.body,
        event_id,
        contact: contacts[i],
        has_shared: true,
        shared_appointment: appointment.id,
        user: currentUser.id,
      });

      contact_appointment.save().catch((err) => {
        console.log('note save err', err.message);
      });

      const appointment_activity = new Activity({
        content,
        contacts: contacts[i],
        type: 'appointments',
        appointments: contact_appointment.id,
        user: currentUser.id,
      });

      appointment_activity.save().catch((err) => {
        console.log('note activity err', err.message);
      });
    }
    return res.send({
      status: true,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'You must connect gmail/outlook',
    });
  }
};

const createTeamCall = async (req, res) => {
  const { currentUser } = req;
  let leader;
  let contacts;

  if (req.body.leader) {
    leader = await User.findOne({ _id: req.body.leader }).catch((err) => {
      console.log('leader find err', err.message);
    });
  }

  const deal_data = { ...req.body };
  delete deal_data.contacts;
  const deal_call = new TeamCall({
    deal_data,
  });

  deal_call.save().catch((err) => {
    console.log('deal team create err', err.message);
  });

  const activity = new Activity({
    team_calls: team_call.id,
    user: currentUser.id,
    content: 'inquire group call',
    type: 'team_calls',
    deals: req.body.deal,
  });

  activity.save().catch((err) => {
    console.log('activity save err', err.message);
  });

  if (req.body.contacts && req.body.contacts.length > 0) {
    contacts = await Contact.find({ _id: { $in: req.body.contacts } }).catch(
      (err) => {
        console.log('contact find err', err.message);
      }
    );
  }

  const team_call = new TeamCall({
    user: currentUser.id,
    ...req.body,
  });

  team_call
    .save()
    .then((data) => {
      if (leader) {
        let guests = '';
        if (contacts) {
          for (let i = 0; i < contacts.length; i++) {
            const first_name = contacts[i].first_name || '';
            const last_name = contacts[i].last_name || '';
            const data = {
              first_name,
              last_name,
            };

            const new_activity = new Activity({
              team_calls: team_call.id,
              user: currentUser.id,
              contacts: contacts[i].id,
              content: 'inquire group call',
              type: 'team_calls',
            });

            new_activity.save().catch((err) => {
              console.log('activity save err', err.message);
            });

            Contact.updateOne(
              {
                _id: contacts[i].id,
              },
              {
                $set: { last_activity: new_activity.id },
              }
            ).catch((err) => {
              console.log('contact update err', err.message);
            });

            const guest = `<tr style="margin-bottom:10px;"><td><span class="icon-user">${getAvatarName(
              data
            )}</label></td><td style="padding-left:5px;">${first_name} ${last_name}</td></tr>`;
            guests += guest;
          }
        }

        const organizer = `<tr><td><span class="icon-user">${getAvatarName({
          full_name: currentUser.user_name,
        })}</label></td><td style="padding-left: 5px;">${
          currentUser.user_name
        }</td></tr>`;

        const templatedData = {
          user_name: currentUser.user_name,
          leader_name: leader.user_name,
          created_at: moment().format('h:mm MMMM Do, YYYY'),
          subject: team_call.subject,
          description: team_call.description || '',
          organizer,
          call_url: urls.TEAM_CALLS + team_call.id,
          guests,
        };

        const params = {
          Destination: {
            ToAddresses: [leader.email],
          },
          Source: mail_contents.NO_REPLAY,
          Template: 'TeamCallRequest',
          TemplateData: JSON.stringify(templatedData),
          ReplyToAddresses: [currentUser.email],
        };

        // Create the promise and SES service object
        ses
          .sendTemplatedEmail(params)
          .promise()
          .then((response) => {
            console.log('success', response.MessageId);
          })
          .catch((err) => {
            console.log('ses send err', err);
          });
      }

      /** **********
       *  Creat dashboard notification to the inviated users
       *  */
      if (leader) {
        const notification = new Notification({
          user: leader.id,
          team_call: team_call.id,
          criteria: 'team_call_invited',
          content: `You've been invited to join a call by ${currentUser.user_name}.`,
        });

        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
      }

      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      console.log('team save err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message,
      });
    });
};

module.exports = {
  getAll,
  getActivity,
  getNotes,
  getAppointments,
  getTeamCalls,
  create,
  moveDeal,
  edit,
  remove,
  getDetail,
  createNote,
  createFollowUp,
  createAppointment,
  createTeamCall,
  sendEmail,
  getEmails,
  updateContact,
};
