const Notification = require('../models/notification');
const Task = require('../models/task');
const Text = require('../models/text');

const get = async (req, res) => {
  const { currentUser } = req;
  const { limit } = req.query;
  const personal_notifications = await Notification.find({
    user: currentUser.id,
    is_read: false,
  }).limit(parseInt(limit));

  const system_notifications = await Notification.find({
    type: 'global',
    del: false,
  }).sort({ updated_at: -1 });

  res.send({
    status: true,
    personal_notifications,
    system_notifications,
  });
};

const bulkRead = (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  Notification.updateMany(
    {
      _id: { $in: ids },
      user: currentUser.id,
    },
    {
      $set: { is_read: true },
    }
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

const bulkUnread = (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  Notification.updateMany(
    {
      _id: { $in: ids },
      type: 'personal',
      user: currentUser.id,
    },
    { is_read: false }
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

const bulkRemove = (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  Notification.deleteMany({
    _id: { $in: ids },
    user: currentUser.id,
  })
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
      {
        type: 'global',
        del: false,
      },
    ],
  })
    .skip((page - 1) * 15)
    .limit(15);

  const total = await Notification.countDocuments({
    $or: [
      {
        user: currentUser.id,
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

const getDelivery = async (req, res) => {
  const { currentUser } = req;
  const sms = await Notification.find({
    user: currentUser.id,
    criteria: 'bulk_sms',
  })
    .populate('contact')
    .catch((err) => {
      console.log('notification find err', err.message);
    });

  return res.send({
    status: true,
    notification: {
      sms,
    },
  });
};

const getStatus = async (req, res) => {
  const { currentUser } = req;

  const emailTasks = await Task.find({
    user: currentUser._id,
    type: 'send_email',
  }).catch((err) => {
    console.log('Emailing tasks getting is failed', err);
  });

  const textTasks = await Task.find({
    user: currentUser._id,
    type: 'bulk_sms',
  }).catch((err) => {
    console.log('Text checking tasks getting is failed', err);
  });

  const receivedTexts = await Text.countDocuments({
    user: currentUser._id,
    type: 1,
    status: 0,
  }).catch((err) => {
    console.log('received text count getting is failed', err);
  });

  const response = {
    emails: emailTasks,
    texts: textTasks,
    unread: receivedTexts,
  };

  let notifications = await Notification.find({
    $or: [{ user: currentUser._id }, { owner: [currentUser._id] }],
    is_read: false,
  })
    .sort({ created_at: 1 })
    .limit(6)
    .catch((err) => {
      console.log('Getting unread notifications', err);
    });
  if (notifications && notifications.length) {
    response.notifications = notifications;
  } else {
    notifications = await Notification.find({
      $or: [{ user: currentUser._id }, { owner: [currentUser._id] }]
    })
      .sort({ created_at: 1 })
      .limit(5)
      .catch((err) => {
        console.log('Getting Latest notifications', err);
      });
    response.notifications = notifications;
  }

  const system_notifications = await Notification.find({
    type: 'global',
    del: false,
  }).sort({ updated_at: -1 });

  response.system_notifications = system_notifications;

  return res.send(response);
};

module.exports = {
  get,
  getPage,
  getDelivery,
  bulkRead,
  bulkUnread,
  bulkRemove,
  getStatus,
};
