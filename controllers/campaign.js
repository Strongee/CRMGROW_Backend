const Campaign = require('../models/campaign');
const CampaignJob = require('../models/campaign_job');
const MailList = require('../models/mail_list');

const system_settings = require('../config/system_settings');

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

  const new_campaign = new Campaign({
    ...req.body,
    contacts: mail_list.contacts,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  new_campaign
    .save()
    .then((campaign) => {
      let daily_limit = 150;

      /**
       * Email Campaign daily limit startup count
       */

      let contacts = mail_list.contacts;
      if (currentUser.connected_email_type === 'gsuit') {
        daily_limit = system_settings.CAMPAIGN_MAIL_START.GSUIT;
      }

      daily_limit =
        contacts.length > daily_limit ? daily_limit : contacts.length;

      while (contacts.length > 0) {
        for (let i = 0; i < daily_limit; i += 15) {
          const due_date = req.body.due_start;
          const campaign_job = new CampaignJob({
            contacts: contacts.slice(i, i + 14),
            campaign: campaign.id,
            due_date,
          });
          campaign_job.save().catch((err) => {
            console.log('campaign job save err', err.message)
          });
        }
      }

      return res.send({
        status: true,
        data: campaign,
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
