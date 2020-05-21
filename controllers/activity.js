const { validationResult } = require('express-validator/check');
const Activity = require('../models/activity');
const Contact = require('../models/contact');

const get = async (req, res) => {
  const { currentUser } = req;
  const count = await Activity.countDocuments({ user: currentUser.id });
  let activity;
  if (typeof req.params.id === 'undefined') {
    activity = await Activity.find({ user: currentUser.id })
      .sort({ updated_at: -1 })
      .populate('contacts')
      .limit(20);
  } else {
    const id = parseInt(req.params.id);
    activity = await Activity.find({ user: currentUser.id })
      .sort({ updated_at: -1 })
      .populate('contacts')
      .skip(id)
      .limit(20);
  }

  return res.send({
    status: true,
    data: {
      activity,
      count,
    },
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const activity = new Activity({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  activity
    .save()
    .then((_res) => {
      const data = _res;
      res.send({
        status: true,
        data,
      });
    })
    .catch((e) => {
      return res.status(500).send({
        status: false,
        error: e,
      });
    });
};

const contactActivity = async (req, res) => {
  const { currentUser } = req;
  const { contact } = req.body;
  const _activity_list = await Activity.find({
    user: currentUser.id,
    contacts: contact,
  }).sort({ updated_at: 1 });
  const _activity_detail_list = [];

  for (let i = 0; i < _activity_list.length; i++) {
    const _activity_detail = await Activity.aggregate([
      {
        $lookup: {
          from: _activity_list[i].type,
          localField: _activity_list[i].type,
          foreignField: '_id',
          as: 'activity_detail',
        },
      },
      {
        $match: { _id: _activity_list[i]._id },
      },
    ]);

    _activity_detail_list.push(_activity_detail[0]);
  }

  return res.send({
    status: true,
    data: _activity_detail_list,
  });
};

const removeBulk = async (req, res) => {
  const { contact, activities } = req.body;
  Activity.deleteMany({ _id: { $in: activities } })
    .then(async () => {
      const lastActivity = await Activity.findOne(
        { contacts: contact },
        {},
        { sort: { _id: -1 } }
      ).catch((err) => {
        console.log('err', err);
      });
      Contact.findByIdAndUpdate(contact, {
        $set: { last_activity: lastActivity.id },
      })
        .then((data) => {
          return res.send({
            status: true,
            data: lastActivity,
          });
        })
        .catch((err) => {
          console.log('err', err);
        });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Error in remove all activities',
      });
    });
};

const removeAll = async (req, res) => {
  const { contact, option } = req.body;
  Activity.deleteMany({ contacts: contact, type: { $nin: ['contacts'] } })
    .then(async () => {
      const contactActivity = await Activity.findOne({
        contacts: contact,
        type: { $in: ['contacts'] },
      }).catch((err) => {
        console.log('err', err);
      });
      Contact.findByIdAndUpdate(contact, {
        $set: { last_activity: contactActivity.id },
      })
        .then((data) => {
          return res.send({
            status: true,
            data: contactActivity,
          });
        })
        .catch((err) => {
          console.log('err', err);
        });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Error in remove all activities',
      });
    });
};

module.exports = {
  get,
  create,
  removeBulk,
  removeAll,
  contactActivity,
};
