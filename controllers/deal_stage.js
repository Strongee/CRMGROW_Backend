const DealStage = require('../models/deal_stage');
const Deal = require('../models/deal');
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const ActivityHelper = require('../helpers/activity');

const getAll = async (req, res) => {
  const { currentUser } = req;

  const data = await DealStage.find({ user: currentUser.id })
    .populate('deals')
    .sort({ priority: 1 });

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Deals doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
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

const remove = async (req, res) => {
  const { currentUser } = req;

  const deal_stage = await DealStage.findOne({
    _id: req.params.id,
    user: currentUser.id,
  }).catch((err) => {
    console.log('deal stage err', err.message);
  });

  if (!deal_stage) {
    return res.status(400).json({
      status: false,
      error: 'Permission invalid',
    });
  }

  Deal.deleteMany({
    _id: { $in: deal_stage.deals },
  }).catch((err) => {
    console.log('remove deal', err.message);
  });

  DealStage.deleteOne({
    _id: req.params.id,
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('deal stage remove err', err.message);
    });
};

const edit = async (req, res) => {
  const { currentUser } = req;

  DealStage.updateOne(
    {
      _id: req.params.id,
      user: currentUser.id,
    },
    {
      ...req.body,
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('deal stage update err', err.message);
      return res.status(500).json({
        status: false,
        error: err.message,
      });
    });
};

module.exports = {
  getAll,
  create,
  remove,
  edit,
};
