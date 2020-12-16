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

const moveDeal = async (req, res) => {
  const { deal_id, position } = req.body;
  let { deal_stage_id } = req.body;

  const deal = await Deal.findOne({ _id: deal_id }).catch((err) => {
    console.log('deal found error', err.message);
    return res.status(500).send(err.message || 'Deal found error');
  });

  try {
    await Deal.updateOne(
      { _id: deal_stage_id },
      {
        $pull: {
          jobs: { $in: [mongoose.Types.ObjectId(job_id)]},
        },
      },
      { new: true }
    ).catch((err) => {
      console.log('source sprint update error', err.message);
      throw err.message || 'Source sprint update error';
    });

    await Job.updateOne(
      { _id: job_id },
      {
        $set: {
          sprint: sprint_id,
        },
      }
    ).catch((err) => {
      console.log('Job update error', err.message);
      throw err.message || 'Job update error';
    });

    if (!sprint_id) {
      sprint_id = job.sprint;
    }
    await Sprint.updateOne(
      { _id: sprint_id },
      {
        $push: {
          jobs: {
            $each: [job_id],
            $position: position,
          },
        },
      }
    ).catch((err) => {
      console.log('destination sprint update error', err.message);
      throw err.message || 'Destination sprint update error';
    });
    return res.send();
  } catch (error) {
    return res.status(500).send(error);
  }
};

module.exports = {
  getAll,
  create,
  moveDeal,
};
