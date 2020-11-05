const Campaign = require('../models/campaign');

const get = async (req, res) => {
  const data = await Campaign.find({ _id: req.params.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Campaign doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const campaign = new Campaign({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  campaign
    .save()
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message || 'Internal server error',
      });
    });
};

module.exports = {
  get,
  create,
};
