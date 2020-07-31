const sgMail = require('@sendgrid/mail');
const mongoose = require('mongoose');
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
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');

const getAll = (req, res) => {
  const { currentUser } = req;

  Team.find({
    $or: [
      {
        members: currentUser.id,
      },
      { owner: currentUser.id },
    ],
  })
    .populate([{ path: 'owner' }, { path: 'members' }])
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const getTeam = (req, res) => {
  const { currentUser } = req;
  Team.find({
    $or: [
      {
        members: req.params.id,
      },
      { owner: req.params.id },
    ],
  })
    .populate({ path: 'owner' })
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const get = (req, res) => {
  const { currentUser } = req;

  Team.findOne({
    $or: [
      {
        _id: req.params.id,
        members: currentUser.id,
      },
      {
        _id: req.params.id,
        owner: currentUser.id,
      },
    ],
  })
    .populate([
      { path: 'owner' },
      { path: 'members' },
      { path: 'invites' },
      { path: 'videos' },
      { path: 'pdfs' },
      { path: 'images' },
      { path: 'automations' },
      { path: 'email_templates' },
      { path: 'requests' },
    ])
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

const get1 = async (req, res) => {
  const { currentUser } = req;
  const team_id = req.params.id;
  Team.findById(team_id)
    .then(async (_team) => {
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

  const old_team = Team.findOne({ owner: currentUser.id }).catch((err) => {
    return res.status(500).send({
      status: false,
      error: err.message,
    });
  });

  if (old_team) {
    return res.status(400).send({
      status: false,
      error: 'You can create only one team.',
    });
  }

  const teamReq = req.body;
  let picture = '';
  if (teamReq.picture) {
    picture = await uploadBase64Image(teamReq.picture);
  }
  const team = new Team({
    ...teamReq,
    picture,
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

  let picture;
  if (req.body.picture) {
    picture = await uploadBase64Image(req.body.picture);
  }

  Team.findOneAndUpdate(
    {
      _id: req.params.id,
      owner: currentUser.id,
    },
    {
      $set: {
        ...req.body,
        picture,
      },
    }
  )
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const bulkInvites = async (req, res) => {
  const { currentUser } = req;
  const { invites, referrals } = req.body;
  const team = await Team.findOne({
    _id: req.params.id,
    $or: [
      {
        members: currentUser.id,
      },
      {
        owner: currentUser.id,
      },
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

  const inviteIds = team.invites;
  const newInvites = [];
  invites.forEach((e) => {
    if (inviteIds.indexOf(e) === -1) {
      inviteIds.push(e);
      newInvites.push(e);
    }
  });

  const referralEmails = team.referrals;
  const newReferrals = [];
  referrals.forEach((e) => {
    if (referralEmails.indexOf(e) === -1) {
      referralEmails.push(e);
      newReferrals.push(e);
    }
  });

  Team.updateOne(
    {
      _id: req.params.id,
    },
    {
      $set: {
        invites: inviteIds,
        referrals: referralEmails,
      },
    }
  )
    .then(async () => {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const invitedUsers = await User.find({
        _id: { $in: newInvites },
        del: false,
      });

      for (let i = 0; i < invitedUsers.length; i++) {
        const invite = invitedUsers[i];

        const msg = {
          to: invite.email,
          from: mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.MAIL,
          templateId: api.SENDGRID.NOTIFICATION_INVITE_TEAM_MEMBER,
          dynamic_template_data: {
            LOGO_URL: urls.LOGO_URL,
            subject: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER.SUBJECT}${currentUser.user_name} has invited you to join ${team.name} in CRMGrow`,
            user_name: invite.user_name,
            owner_name: currentUser.user_name,
            team_name: team.name,
            ACCEPT_URL: urls.TEAM_ACCEPT_URL + team.id,
          },
        };
        sgMail.send(msg);
      }

      res.send({
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

  const members = team.members;
  const invites = team.invites;
  if (members.indexOf(currentUser.id) === -1) {
    members.push(currentUser.id);
  }
  if (invites.indexOf(currentUser.id) !== -1) {
    const pos = invites.indexOf(currentUser.id);
    invites.splice(pos, 1);
  }

  Team.updateOne(
    {
      _id: req.params.id,
    },
    {
      $set: {
        members,
        invites,
      },
    }
  )
    .then(async () => {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const msg = {
        to: team.owner.email,
        from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
        templateId: api.SENDGRID.TEAM_ACCEPT_NOTIFICATION,
        dynamic_template_data: {
          subject: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name}`,
          activity: `${mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name} has accepted your invitation to join ${team.name} in CRMGrow`,
          team:
            "<a href='" +
            urls.TEAM_URL +
            team.id +
            "'><img src='" +
            urls.DOMAIN_URL +
            "assets/images/team.png'/></a>",
        },
      };

      sgMail
        .send(msg)
        .then()
        .catch((err) => {
          console.log('send message err: ', err);
        });
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

const acceptRequest = async (req, res) => {
  const { currentUser } = req;
  const { team_id, request_id } = req.body;

  const team = await Team.findOne({
    _id: team_id,
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

  const request = await User.findOne({ _id: request_id, del: false });

  if (!request) {
    return res.status(400).send({
      status: false,
      error: 'No exist user',
    });
  }

  const members = team.members;
  const requests = team.requests;
  if (members.indexOf(request_id) === -1) {
    members.push(request_id);
  }
  if (requests.indexOf(request_id) !== -1) {
    const pos = requests.indexOf(request_id);
    requests.splice(pos, 1);
  }

  Team.updateOne(
    {
      _id: team_id,
    },
    {
      $set: {
        members,
        requests,
      },
    }
  )
    .then(async () => {
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const msg = {
        to: request.email,
        from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
        templateId: api.SENDGRID.TEAM_ACCEPT_NOTIFICATION,
        dynamic_template_data: {
          subject: `${mail_contents.NOTIFICATION_REQUEST_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name}`,
          activity: `${mail_contents.NOTIFICATION_REQUEST_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name} has accepted your request to join ${team.name} in CRMGrow`,
          team:
            "<a href='" +
            urls.TEAM_URL +
            team.id +
            "'><img src='" +
            urls.DOMAIN_URL +
            "assets/images/team.png'/></a>",
        },
      };

      sgMail
        .send(msg)
        .then()
        .catch((err) => {
          console.log('send message err: ', err);
        });
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

  await Video.updateMany(
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
        videos: videoIds,
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
      res.status(500).json({
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

  await PDF.updateMany(
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
        pdfs: pdfIds,
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
      res.status(500).json({
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

  await Image.updateMany(
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
      res.status(500).json({
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

  await Automation.updateMany(
    { _id: { $in: automation_ids } },
    {
      $set: { role: 'team' },
    }
  );

  const automationIds = team.automations;
  const newTeamAutomations = [];
  automation_ids.forEach((e) => {
    if (automationIds.indexOf(e) === -1) {
      automationIds.push(e);
      newTeamAutomations.push(e);
    }
  });

  Team.updateOne(
    { _id: team_id },
    {
      $set: { automations: automationIds },
    }
  )
    .then(async (data) => {
      const updatedAutomations = await Automation.find({
        _id: { $in: newTeamAutomations },
      });
      res.send({
        status: true,
        data: updatedAutomations,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      res.status(500).json({
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

  EmailTemplate.updateMany(
    { _id: { $in: template_ids } },
    {
      $set: { role: 'team' },
    }
  ).catch((err) => {
    console.log('Error', err);
  });

  const templateIds = team.email_templates;
  const newTeamTemplates = [];
  template_ids.forEach((e) => {
    if (templateIds.indexOf(e) === -1) {
      templateIds.push(e);
      newTeamTemplates.push(e);
    }
  });

  Team.updateOne(
    { _id: team_id },
    {
      $set: { email_templates: templateIds },
    }
  )
    .then(async () => {
      const updatedTemplates = await EmailTemplate.find({
        _id: { $in: newTeamTemplates },
      });
      res.send({
        status: true,
        data: updatedTemplates,
      });
    })
    .catch((err) => {
      console.log('err', err.message);
      res.status(500).json({
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

const requestTeam = async (req, res) => {
  const { currentUser } = req;
  const team_id = req.params.team;
  const team = await Team.findById(team_id).populate('owner');
  if (team.owner._id + '' === currentUser._id + '') {
    return res.status(400).send({
      status: false,
      error: 'You are a owner of this team.',
    });
  }
  if (team.members.indexOf(currentUser._id) !== -1) {
    return res.status(400).send({
      status: false,
      error: 'You are a member already.',
    });
  }
  if (team.requests.indexOf(currentUser._id) !== -1) {
    return res.send({
      status: true,
    });
  }

  sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

  const msg = {
    to: team.owner.email,
    from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
    templateId: api.SENDGRID.TEAM_ACCEPT_NOTIFICATION,
    dynamic_template_data: {
      subject: `${mail_contents.NOTIFICATION_REQUEST_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name}`,
      activity: `${mail_contents.NOTIFICATION_REQUEST_TEAM_MEMBER_ACCEPT.SUBJECT}${currentUser.user_name} has requested to join your ${team.name} in CRMGrow`,
      team:
        "<a href='" +
        urls.TEAM_ACCEPT_REQUEST_URL +
        `?team=${team.id}&user=${currentUser.id}` +
        "'><img src='" +
        urls.DOMAIN_URL +
        "assets/images/accept.png'/></a>",
    },
  };

  sgMail
    .send(msg)
    .then()
    .catch((err) => {
      console.log('send message err: ', err);
    });

  team.requests.push(currentUser._id);
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

const remove = async (req, res) => {
  Team.deleteOne({
    _id: req.params.id,
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

module.exports = {
  getAll,
  getTeam,
  get,
  create,
  update,
  remove,
  bulkInvites,
  acceptInviation,
  acceptRequest,
  searchUser,
  shareVideos,
  sharePdfs,
  shareImages,
  shareAutomations,
  shareEmailTemplates,
  requestTeam,
};
