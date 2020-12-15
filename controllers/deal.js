const Deal = require('../models/deal');
const DealStage = require('../models/deal_stage');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const ActivityHelper = require('../helpers/activity');

const getAll = async (req, res) => {
  const { currentUser } = req;

  const data = await Deal.find({
    user: currentUser.id,
    contact: req.body.contact,
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

      const activity = new Activity({
        content: detail_content,
        contacts: _deal.contact,
        user: currentUser.id,
        type: 'deals',
        deals: _deal.id,
      });

      activity.save().then((_activity) => {
        Contact.updateOne(
          { _id: _deal.contact },
          { $set: { last_activity: _activity.id } }
        ).catch((err) => {
          console.log('err', err);
        });

        const myJSON = JSON.stringify(_deal);
        const data = JSON.parse(myJSON);
        data.activity = _activity;
        data.deal_stage = req.body.deal_stage;
        res.send({
          status: true,
          data,
        });
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

module.exports = {
  getAll,
  create,
};
