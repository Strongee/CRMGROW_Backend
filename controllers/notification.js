const Notification = require('../models/notification');

const get = async (req, res) => {
  const { currentUser } = req;
  const notifications = await Notification.find({
    $or: [
      {
        type: 'personal',
        user: currentUser.id,
      },
      { type: 'global' },
    ],
  });

  res.send({
    status: true,
    notifications,
  });
};

module.exports = {
  get,
};
