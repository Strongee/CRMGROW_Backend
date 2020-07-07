const sgMail = require('@sendgrid/mail');

const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const api = require('../config/api');
const Team = require('../models/team');
const User = require('../models/user');
const Image = require('../models/image');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Automation = require('../models/automation');
const EmailTemplate = require('../models/email_template');

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

const shareVideos = async (req, res) => {
  const { currentUser } = req;
  const { video_ids, team_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
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

  Video.update(
    { _id: { $in: video_ids } },
    {
      role: { $set: 'team' },
    }
  );

  Team.updateOne(
    { _id: team_id },
    {
      videos: { $push: video_ids },
    }
  ).catch((err) => {
    console.log('err', err.message);
    res.send(500).json({
      status: false,
      error: err.message,
    });
  });
};

const sharePdfs = async (req, res) => {
  const { currentUser } = req;
  const { pdf_ids, team_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
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

  PDF.update(
    { _id: { $in: pdf_ids } },
    {
      role: { $set: 'team' },
    }
  );

  Team.updateOne(
    { _id: team_id },
    {
      pdfs: { $push: pdf_ids },
    }
  ).catch((err) => {
    console.log('err', err.message);
    res.send(500).json({
      status: false,
      error: err.message,
    });
  });
};

const shareImages = async (req, res) => {
  const { currentUser } = req;
  const { image_ids, team_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
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

  Image.update(
    { _id: { $in: image_ids } },
    {
      role: { $set: 'team' },
    }
  );
  Team.updateOne(
    { _id: team_id },
    {
      images: { $push: image_ids },
    }
  ).catch((err) => {
    console.log('err', err.message);
    res.send(500).json({
      status: false,
      error: err.message,
    });
  });
};

const shareAutomations = async (req, res) => {
  const { currentUser } = req;
  const { automation_ids, team_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
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

  Automation.update(
    { _id: { $in: automation_ids } },
    {
      role: { $set: 'team' },
    }
  );

  Team.updateOne(
    { _id: team_id },
    {
      automations: { $push: automation_ids },
    }
  ).catch((err) => {
    console.log('err', err.message);
    res.send(500).json({
      status: false,
      error: err.message,
    });
  });
};

const shareEmailTemplates = async (req, res) => {
  const { currentUser } = req;
  const { template_ids, team_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
    $or: [
      {
        owner: currentUser.id,
      },
      { editors: currentUser.id },
    ],
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

  EmailTemplate.update(
    { _id: { $in: template_ids } },
    {
      role: { $set: 'team' },
    }
  );

  Team.updateOne(
    { _id: team_id },
    {
      email_templates: { $push: template_ids },
    }
  ).catch((err) => {
    console.log('err', err.message);
    res.send(500).json({
      status: false,
      error: err.message,
    });
  });
};

const searchUser = async (req, res) => {
  const search = req.body.search;
  let data = [];
  data = await User.find({
    $or: [
      {
        user_name: { $regex: '*.' + search + '.*', $options: 'i' },
        del: false,
      },
      {
        email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
        del: false,
      },
      {
        cell_phone: {
          $regex:
            '.*' +
            search
              .split('')
              .filter((char) => /^[^\(\)\- ]$/.test(char))
              .join('') +
            '.*',
          $options: 'i',
        },
        del: false,
      },
    ],
  })
    .sort({ first_name: 1 })
    .limit(8)
    .catch((err) => {
      console.log('err', err);
    });

  return res.send({
    status: true,
    data,
  });
};

module.exports = {
  get,
  create,
  update,
  bulkInvites,
  acceptInviation,
  searchUser,
  shareVideos,
  sharePdfs,
  shareImages,
  shareAutomations,
  shareEmailTemplates,
};
