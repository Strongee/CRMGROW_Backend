const phone = require('phone');
const mongoose = require('mongoose');
const Contact = require('../models/contact');
const Team = require('../models/team');
const Activity = require('../models/activity');
const Garbage = require('../models/garbage');
const Automation = require('../models/automation');
const Label = require('../models/label');
const LabelHelper = require('../helpers/label');
const garbageHelper = require('../helpers/garbage.js');

const system_settings = require('../config/system_settings');
const jwt = require('jsonwebtoken');
const api = require('../config/api');
const { activeNext } = require('./time_line');

const addContact = async (req, res) => {
  const { currentUser } = req;
  const { label, cell_phone } = req.body;
  let max_upload_count = 0;
  let count = 0;

  const contact_info = currentUser.contact_info;
  if (contact_info['is_limit']) {
    count = await Contact.countDocuments({ user: currentUser.id });
    max_upload_count =
      contact_info.max_count || system_settings.CONTACT_UPLOAD_LIMIT.BASIC;
  }

  if (contact_info['is_limit'] && max_upload_count < count) {
    return res.status(400).send({
      status: false,
      error: 'You are exceed for max contacts',
    });
  }

  if (cell_phone) {
    req.body.cell_phone = phone(cell_phone)[0];
  } else {
    delete req.body.cell_phone;
  }

  const contact = new Contact({
    ...req.body,
    user: currentUser.id,
  });

  contact
    .save()
    .then((_contact) => {
      const detail_content = 'added contact';

      const activity = new Activity({
        content: detail_content,
        contacts: _contact.id,
        user: currentUser.id,
        type: 'contacts',
      });

      activity.save().then((_activity) => {
        _contact['last_activity'] = _activity.id;
        _contact.save().catch((err) => {
          console.log('contact save err', err.message);
        });

        return res.send({
          status: true,
          data: {
            ..._contact,
            label,
          },
        });
      });
    })
    .catch((err) => {
      console.log('contact save error', err.message);
      return res.send({
        status: false,
        error: 'Internal server error',
      });
    });
};

const updateContact = async (req, res) => {
  const { label, cell_phone } = req.body;
  const { currentUser } = req;

  if (label) {
    req.body.label = await LabelHelper.convertLabel(currentUser.id, label);
  } else {
    delete req.body.label;
  }
  if (cell_phone) {
    req.body.cell_phone = phone(cell_phone)[0];
  } else {
    delete req.body.cell_phone;
  }
  Contact.updateOne(
    {
      _id: req.body.id,
      user: currentUser.id,
    },
    {
      $set: {
        ...req.body,
      },
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('contact update err', err.message);
      return res.send({
        status: false,
        error: 'Internal server error',
      });
    });
};

const getContact = (req, res) => {
  const { currentUser } = req;
  Contact.findOne({
    _id: req.body.id,
    user: currentUser.id,
  })
    .then((contact) => {
      if (contact) {
        return res.send({
          status: true,
          data: contact,
        });
      } else {
        return res.send({
          status: false,
          error: 'Invalid permission',
        });
      }
    })
    .catch((err) => {
      console.log('get contact error', err.message);
      return res.send({
        status: false,
        error: 'Internal server error',
      });
    });
};

const createToken = (req, res) => {
  const { currentUser } = req;
  const token = jwt.sign(
    { id: currentUser.id, api_loggin: true },
    api.JWT_SECRET
  );
  Garbage.updateOne(
    { user: currentUser.id },
    {
      $set: { access_token: token },
    }
  ).catch((err) => {
    console.log('get contact error', err.message);
  });
  return res.send({
    status: true,
    token,
  });
};

const getAutomations = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const automations = await Automation.aggregate([
    {
      $match: {
        $or: [
          { user: currentUser.id, del: false },
          {
            role: 'admin',
            company,
            del: false,
          },
          {
            shared_members: currentUser.id,
          },
        ],
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        title: true,
      },
    },
  ]);

  return res.send(automations);
};

const getLabels = async (req, res) => {
  const { currentUser } = req;
  const garbage = await garbageHelper.get(currentUser);

  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }

  let editedLabels = [];
  if (garbage && garbage['edited_label']) {
    editedLabels = garbage['edited_label'];
  }

  // const company = currentUser.company || 'eXp Realty';
  const labels = await Label.aggregate([
    {
      $match: {
        $or: [
          { user: currentUser.id },
          {
            role: 'admin',
            _id: { $nin: editedLabels },
          },
        ],
      },
    },
    {
      $project: {
        _id: false,
        id: '$_id',
        name: true,
      },
    },
  ]);

  res.send(labels);
};

const searchContact = async (req, res, next) => {
  const { currentUser } = req;
  const contact = await Contact.findOne({
    email: req.body.email,
    user: currentUser.id,
  }).catch((err) => {
    console.log('contact find err', err.message);
    return res.send('contact find err');
  });

  req.body.contact = contact.id;
  req.params.id = contact.id;
  next();
};

module.exports = {
  createToken,
  getContact,
  addContact,
  updateContact,
  getAutomations,
  getLabels,
  searchContact,
};
