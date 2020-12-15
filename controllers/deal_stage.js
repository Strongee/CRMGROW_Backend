const DealStage = require('../models/deal_stage');
const Deal = require('../models/deal');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const ActivityHelper = require('../helpers/activity');

const getAll = async (req, res) => {
  const { currentUser } = req;

  const deal_stages = await DealStage.find({ user: currentUser.id });
  const deals = await Deal.find({ user: currentUser.id });

  if (!deal_stages) {
    return res.status(400).json({
      status: false,
      error: 'Deals doesn`t exist',
    });
  }

  return res.send({
    status: true,
    deal_stages,
    deals,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const deal_stage = new DealStage({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  deal_stage
    .save()
    .then((_deal_stage) => {
      return res.send({
        status: true,
        data: _deal_stage,
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
