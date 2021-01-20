const mongoose = require('mongoose');
const Deal = require('../models/deal');
const DealStage = require('../models/deal_stage');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Note = require('../models/note');
const FollowUp = require('../models/follow_up');
const ActivityHelper = require('../helpers/activity');
const Email = require('../models/email');
const EmailHelper = require('../helpers/email');

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

  return res.send({
    status: true,
  });
};

const edit = async (req, res) => {
  const { currentUser } = req;

  Deal.updateOne({
    _id: req.params.id,
    user: currentUser.id,
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('deal update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
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

  const activity = await Activity.find({
    user: currentUser.id,
    deals: req.body.deal,
  }).catch((err) => {
    console.log('activity get err', err.message);
  });

  return res.send({
    status: true,
    data: activity,
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
    type: 'deal-notes',
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
  const { deal, content, due_date } = req.body;
  const followup = new FollowUp({
    user: currentUser.id,
    deal,
    content,
    due_date,
  });

  followup.save().catch((err) => {
    console.log('new follow up save err', err.message);
  });

  const activity_content = 'added follow up';
  const activity = new Activity({
    content: activity_content,
    type: 'deal-follow_ups',
    follow_ups: followup.id,
    deals: req.body.real,
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
    type: 'deal-emails',
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

};

const createAppointment = async (req, res) => {
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
    type: 'deal-notes',
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

module.exports = {
  getAll,
  getActivity,
  getNotes,
  getAppointments,
  create,
  moveDeal,
  edit,
  remove,
  getDetail,
  createNote,
  createFollowUp,
  createAppointment,
  sendEmail,
  getEmails,
};
