const Team = require('../models/team');

const get = async (req, res) => {
  const { currentUser } = req;
  const query = { ...req.query };
  const contact = query['contact'];

  const data = await Team.find({ user: currentUser.id, contact });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {};

module.exports = {
  get,
  create,
};
