const Notification = require('../models/notification');

const get = async (req, res) => {
  const { currentUser } = req;
  const { limit } = req.query;
  const notifications = await Notification.find({
    $or: [
      {
        user: currentUser.id,
        is_read: false,
      },
      { type: 'global' },
    ],
  }).limit(parseInt(limit));

  res.send({
    status: true,
    notifications,
  });
};

const bulkRead = (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  Notification.updateMany(
    {
      _id: { $in: ids },
      type: 'personal',
      user: currentUser.id,
    },
    { is_read: true }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const getPage = async (req, res) => {
  const { currentUser } = req;
  const { page } = req.params;

  const notifications = await Notification.find({
    $or: [
      {
        user: currentUser.id,
        is_read: false,
      },
      { type: 'global' },
    ],
  })
    .skip((page - 1) * 15)
    .limit(15);

  const total = await Notification.countDocuments({
    $or: [
      {
        user: currentUser.id,
        is_read: false,
      },
      { type: 'global' },
    ],
  });

  return res.json({
    status: true,
    notifications,
    total,
  });
};

module.exports = {
  get,
  getPage,
  bulkRead,
};
