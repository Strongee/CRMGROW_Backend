const Campaign = require('../models/campaign');
const MailList = require('../models/mail_list');
const system_settings = require('../config/system_settings');
const user = require('./user');

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

  const mail_list = await MailList.findOne({
    _id: req.body.mail_list,
  });

  const campaign = new Campaign({
    ...req.body,
    contacts: mail_list.contacts,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  campaign
    .save()
    .then((data) => {
      let campaign = 150;

      /**
       * Email Campaign daily limit startup count
       */

      if (currentUser.connected_email_type === 'gsuit') {
        campaign = system_settings.CAMPAIGN_MAIL_START.GSUIT;
      }

      
      return res.send({
        status: true,
        data,
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
