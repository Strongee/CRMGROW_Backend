const Notification = require('../models/notification');

const get = async (req, res) => {
  const { currentUser } = req;
  const notifications = await Notification.find({
    $or: [
      {
        type: 'personal',
        user: currentUser.id,
        is_read: false,
      },
      { type: 'global' },
    ],
  });

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

module.exports = {
  get,
  bulkRead,
};
