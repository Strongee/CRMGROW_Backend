const MailList = require('../models/mail_list');

const getAll = async (req, res) => {
  const { currentUser } = req;
  const data = await MailList.find({ user: currentUser.id }).catch((err) => {
    console.log('mail list find err', err.message);
  });

  return res.send({
    status: true,
    data,
  });
};

const get = async (req, res) => {
  const data = await MailList.findOne({ _id: req.params.id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Mail list doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const mail_list = new MailList({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  mail_list
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
  getAll,
  create,
};
