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
const Contact = require('../models/contact');

const getAll = (req, res) => {
  const { currentUser } = req;

  Team.find({
    $or: [
      {
        members: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
    ],
  })
    .populate('members')
    .then(async (data) => {
      let teams = [];
      for (let i = 0; i < data.length; i++) {
        const owner = await User.findById(data[i]['owner'][0]);
        const team = {
          ...data[i]._doc,
          owner,
        };
        teams.push(team);
      }
      return res.send({
        status: true,
        data: teams,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
        error: err.message,
      });
    });
};

const get = async (req, res) => {
  const { currentUser } = req;
  const team_id = req.params.id;
  Team.findById(team_id)
    .then(async (_team) => {
      console.log('Team', _team);
      if (
        _team.owner.indexOf(currentUser.id) !== -1 ||
        _team.members.indexOf(currentUser.id) !== -1
      ) {
        const owner = await User.findById(_team.owner);
        const members = await User.find({ _id: { $in: _team.members } });
        const videos = await Video.find({ _id: { $in: _team.videos } });
        const pdfs = await PDF.find({ _id: { $in: _team.pdfs } });
        const images = await Image.find({ _id: { $in: _team.images } });
        const automations = await Automation.find({
          _id: { $in: _team.automations },
        });
        const contacts = await Contact.find({ _id: { $in: _team.contacts } });
        const templates = await EmailTemplate.find({
          _id: { $in: _team.email_templates },
        });
        return res.send({
          status: true,
          data: {
            ..._team._doc,
            owner,
            members,
            videos,
            pdfs,
            images,
            automations,
            contacts,
            templates,
          },
        });
      } else {
        return res.status(400).send({
          status: false,
          error: 'Invalid Permission',
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

const create = async (req, res) => {
  const { currentUser } = req;

  const team = new Team({
    ...req.body,
    owner: currentUser.id,
  });

  team
    .save()
    .then((_team) => {
      return res.send({
        status: true,
        data: _team,
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

  const inviteIds = team.invites;
  const newInvites = [];
  invites.forEach((e) => {
    if (inviteIds.indexOf(e) === -1) {
      inviteIds.push(e);
      newInvites.push(e);
    }
  });

  Team.updateOne(
    {
      _id: req.params.id,
      owner: currentUser.id,
    },
    {
      $set: {
        invites: inviteIds,
      },
    }
  )
    .then(async () => {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const invitedUsers = await User.find({
        _id: { $in: invites },
      });

      for (let i = 0; i < invitedUsers.length; i++) {
        const invite = invitedUsers[i];

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
      $set: { role: 'team' },
    }
  );

  const videoIds = team.videos;
  const newTeamVideos = [];
  video_ids.forEach((e) => {
    if (videoIds.indexOf(e) === -1) {
      videoIds.push(e);
      newTeamVideos.push(e);
    }
  });

  Team.updateOne(
    { _id: team_id },
    {
      $set: {
        videos: [videoIds],
      },
    }
  )
    .then(async (_data) => {
      const updatedVideos = await Video.find({ _id: { $in: newTeamVideos } });
      res.send({
        status: true,
        data: updatedVideos,
      });
    })
    .catch((err) => {
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
      $set: { role: 'team' },
    }
  );

  const pdfIds = team.pdfs;
  const newTeamPdfs = [];
  pdf_ids.forEach((e) => {
    if (pdfIds.indexOf(e) === -1) {
      pdfIds.push(e);
      newTeamPdfs.push(e);
    }
  });

  Team.updateOne(
    { _id: team_id },
    {
      $set: {
        pdfs: [pdfIds],
      },
    }
  )
    .then(async (data) => {
      const updatedPdfs = await PDF.find({ _id: { $in: newTeamPdfs } });
      res.send({
        status: true,
        data: updatedPdfs,
      });
    })
    .catch((err) => {
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
      $set: { role: 'team' },
    }
  );

  const imageIds = team.images;
  const newTeamImages = [];
  image_ids.forEach((e) => {
    if (imageIds.indexOf(e) === -1) {
      imageIds.push(e);
      newTeamImages.push(e);
    }
  });

  Team.updateOne(
    { _id: team_id },
    {
      $set: { images: imageIds },
    }
  )
    .then(async (_data) => {
      const updatedImages = await Image.find({ _id: { $in: newTeamImages } });
      res.send({
        status: true,
        data: updatedImages,
      });
    })
    .catch((err) => {
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
        user_name: { $regex: '.*' + search + '.*', $options: 'i' },
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
  getAll,
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
