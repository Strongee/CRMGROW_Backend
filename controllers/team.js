const sgMail = require('@sendgrid/mail');

const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const Team = require('../models/team');
const User = require('../models/user');

const get = (req, res) => {
  const { currentUser } = req;

  Team.find({ members: currentUser.id })
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const create = async (req, res) => {
  const { currentUser } = req;

  const team = new Team({
    ...req.body,
    owner: currentUser.id,
  });

  team
    .save()
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

const update = async (req, res) => {
  const { currentUser } = req;

  const team = await Team.findOne({
    _id: req.params.id,
    owner: currentUser.id,
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  Team.updateOne(
    {
      _id: req.params.id,
      owner: currentUser.id,
    },
    {
      $set: {
        ...req.body,
      },
    }
  ).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message,
    });
  });
};

const bulkInvites = async (req, res) => {
  const { currentUser } = req;
  const { invites } = req.body;
  const team = await Team.findOne({
    _id: req.params.id,
    owner: currentUser.id,
  }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message || 'Team found err',
    });
  });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  Team.updateOne(
    {
      _id: req.params.id,
      owner: currentUser.id,
    },
    {
      $push: {
        invites,
      },
    }
  )
    .then(async () => {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const invites = await User.find({
        _id: { $in: invites },
      });

      for (let i = 0; i < invites.length; i++) {
        const invite = invites[i];

        const msg = {
          to: invite.email,
          from: mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.MAIL,
          templateId: api.SENDGRID.NOTIFICATION_INVITE_TEAM_MEMBER,
          dynamic_template_data: {
            subject: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER.SUBJECT}${currentUser.user_name} has invited you to join ${team.name} in CRMGrow`,
            user_name: invite.user_name,
            owner_name: currentUser.user_name,
            team_name: team.name,
            ACCEPT_URL: urls.TEAM_ACCEPT_URL + team.id,
          },
        };

        sgMail
          .send(msg)
          .then()
          .catch((err) => {
            console.log('send message err: ', err);
          });
      }
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const acceptInviation = async (req, res) => {
  const { currentUser } = req;
  const team = await Team.findOne({
    _id: req.params.id,
    invites: currentUser.id,
  })
    .populate('owner')
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Team found err',
      });
    });

  if (!team) {
    return res.status(400).send({
      status: false,
      error: 'Invalid Permission',
    });
  }

  Team.updateOne(
    {
      _id: req.params.id,
      owner: currentUser.id,
    },
    {
      $push: {
        members: currentUser.id,
      },
      $pull: {
        invites: currentUser.id,
      },
    }
  )
    .then(async () => {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const invites = await User.find({
        _id: { $in: invites },
      });

      const msg = {
        to: team.owner.email,
        from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
        templateId: api.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
        dynamic_template_data: {
          subject: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name}`,
          activity: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name} has accepted invitation to join ${team.name} in CRMGrow`,
        },
      };

      sgMail
        .send(msg)
        .then()
        .catch((err) => {
          console.log('send message err: ', err);
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
  create,
  update,
  bulkInvites,
  acceptInviation,
};
