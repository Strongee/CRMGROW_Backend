const sgMail = require('@sendgrid/mail');
const mongoose = require('mongoose');
const urls = require('../constants/urls');
const mail_contents = require('../constants/mail_contents');
const AWS = require('aws-sdk');
const short = require('short-uuid');
const moment = require('moment');
const api = require('../config/api');
const Activity = require('../models/activity');
const Team = require('../models/team');
const User = require('../models/user');
const Image = require('../models/image');
const Video = require('../models/video');
const PDF = require('../models/pdf');
const Automation = require('../models/automation');
const EmailTemplate = require('../models/email_template');
const VideoTracker = require('../models/video_tracker');
const PDFTracker = require('../models/pdf_tracker');
const ImageTracker = require('../models/image_tracker');
const Contact = require('../models/contact');
const Notification = require('../models/notification');
const TeamCall = require('../models/team_call');
const TimeLine = require('../models/time_line');
const { uploadBase64Image, removeFile } = require('../helpers/fileUpload');
const { getAvatarName } = require('../helpers/utility');

const ses = new AWS.SES({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_SES_REGION,
  apiVersion: '2010-12-01',
});

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
    .populate([
      {
        path: 'owner',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          cell_phone: 1,
        },
      },
      {
        path: 'members',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          cell_phone: 1,
        },
      },
      {
        path: 'editors',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          cell_phone: 1,
        },
      },
    ])
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

const getInvitedTeam = (req, res) => {
  const { currentUser } = req;

  Team.find({ invites: currentUser.id })
    .populate('owner')
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
      { path: 'requests' },
    ])
    .then(async (data) => {
      if (data && !data.join_link) {
        const join_link = short.generate();
        Team.updateOne(
          { _id: req.params.id },
          {
            $set: { join_link },
          }
        ).catch((err) => {
          console.log('team join link udpate err', err.message);
        });

        return res.send({
          status: true,
          data: { ...data._doc, join_link },
        });
      } else {
        return res.send({
          status: true,
          data,
        });
      }
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

  const old_team = await Team.findOne({ owner: currentUser.id }).catch(
    (err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    }
  );

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

  const join_link = short.generate();
  const team = new Team({
    ...teamReq,
    picture,
    owner: currentUser.id,
    join_link,
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
  } else {
    picture = team.picture;
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
    },
    { new: true }
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
      const invitedUsers = await User.find({
        _id: { $in: newInvites },
        del: false,
      });

      /** **********
       *  Send email notification to the inviated users
       *  */
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      for (let i = 0; i < invitedUsers.length; i++) {
        const invite = invitedUsers[i];
        const user_name = invite.user_name
          ? invite.user_name.split(' ')[0]
          : '';
        const msg = {
          to: invite.email,
          from: mail_contents.NOTIFICATION_INVITE_TEAM_MEMBER_ACCEPT.MAIL,
          templateId: api.SENDGRID.NOTIFICATION_INVITE_TEAM_MEMBER,
          dynamic_template_data: {
            LOGO_URL: urls.LOGO_URL,
            subject: `You've been invited to join team ${team.name} in CRMGrow`,
            user_name,
            owner_name: currentUser.user_name,
            team_name: team.name,
            ACCEPT_URL: urls.TEAM_ACCEPT_URL + team.id,
          },
        };
        sgMail.send(msg).catch((err) => {
          console.log('team invitation email err', err);
        });
      }

      /** **********
       *  Creat dashboard notification to the inviated users
       *  */

      for (let i = 0; i < invitedUsers.length; i++) {
        const invite = invitedUsers[i];
        const team_url = `<a href="${urls.TEAM_URL}">${team.name}</a>`;
        const notification = new Notification({
          user: invite.id,
          team: team.id,
          criteria: 'team_invited',
          content: `You've been invited to join team ${team_url} in CRMGrow`,
        });
        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
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
      /** **********
       *  Send email accept notification to the inviated users
       *  */
      sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

      const owners = team.owner;
      for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        const msg = {
          to: owner.email,
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
      }

      /** **********
       *  Mark read true dashboard notification for accepted users
       *  */

      Notification.updateOne(
        { team: team.id, user: currentUser.id, criteria: 'team_invited' },
        { is_read: true }
      ).catch((err) => {
        console.log('err', err.message);
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
    $or: [{ owner: currentUser.id }, { editors: currentUser.id }],
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

      Notification.updateOne(
        { team: team.id, user: currentUser.id, criteria: 'team_requested' },
        { is_read: true }
      ).catch((err) => {
        console.log('err', err.message);
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
    {
      _id: { $in: video_ids },
      user: currentUser.id,
    },
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
      const data = [];
      const updatedVideos = await Video.find({ _id: { $in: newTeamVideos } });

      for (let i = 0; i < updatedVideos.length; i++) {
        const video = updatedVideos[i];
        if (video) {
          const views = await VideoTracker.countDocuments({
            video: video.id,
            user: currentUser.id,
          });

          const video_detail = {
            ...video._doc,
            views,
            material_type: 'video',
          };

          data.push(video_detail);
        }
      }

      res.send({
        status: true,
        data,
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
    .then(async (_data) => {
      const data = [];

      const updatedPdfs = await PDF.find({ _id: { $in: newTeamPdfs } });
      for (let i = 0; i < updatedPdfs.length; i++) {
        const pdf = updatedPdfs[i];
        const views = await PDFTracker.countDocuments({
          pdf: pdf.id,
          user: currentUser.id,
        });

        const video_detail = {
          ...pdf._doc,
          views,
          material_type: 'video',
        };

        data.push(video_detail);
      }

      return res.send({
        status: true,
        data,
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
  const { currentUser } = req;
  const skip = req.body.skip || 0;

  const user_array = await User.find({
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
    _id: { $nin: [currentUser.id] },
  })
    .sort({ first_name: 1 })
    .skip(skip)
    .limit(8)
    .catch((err) => {
      console.log('err', err);
    });

  const team_array = await Team.find({
    name: { $regex: '.*' + search + '.*', $options: 'i' },
  })
    .populate({ path: 'owner' })
    .sort({ first_name: 1 })
    .limit(8)
    .skip(skip)
    .catch((err) => {
      console.log('err', err);
    });

  return res.send({
    status: true,
    user_array,
    team_array,
  });
};

const requestTeam = async (req, res) => {
  const { currentUser } = req;
  const { searchedUser, team_id } = req.body;
  const team = await Team.findById(team_id);
  if (team.owner.indexOf(currentUser._id) !== -1) {
    return res.status(400).send({
      status: false,
      error: 'You are a owner already.',
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

  let senders;
  if (searchedUser && team.editors.indexOf(searchedUser) !== -1) {
    const editor = await User.findOne({ _id: searchedUser });
    senders = [editor];
  } else if (searchedUser && team.owner.indexOf(searchedUser) !== -1) {
    const owner = await User.findOne({ _id: searchUser });
    senders = [owner];
  } else {
    const owner = await User.find({ _id: { $in: team.owner } });
    senders = owner;
  }

  sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

  for (let i = 0; i < senders.length; i++) {
    const sender = senders[i];

    /**
     *
     */
    const msg = {
      to: sender.email,
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
      .then(() => {
        /** **********
         *  Creat dashboard notification to the team owner
         *  */

        const team_url = `<a href="${urls.TEAM_URL}">${team.name}</a>`;
        const notification = new Notification({
          user: sender.id,
          team: team.id,
          criteria: 'team_requested',
          content: `${currentUser.user_name} has requested to join your ${team_url} in CRMGrow`,
        });
        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
      })
      .catch((err) => {
        console.log('send message err: ', err);
      });
  }

  if (team.requests.indexOf(currentUser._id) === -1) {
    team.requests.push(currentUser._id);
    team.save().catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
  }
  return res.send({
    status: true,
  });
};

const remove = async (req, res) => {
  const team = await Team.findOne({ _id: req.params.id }).catch((err) => {
    console.log('team found error', err.message);
  });

  if (team.videos && team.videos.length > 0) {
    Video.updateMany(
      {
        _id: {
          $in: team.videos,
        },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.pdfs && team.pdfs.length > 0) {
    PDF.updateMany(
      {
        _id: { $in: team.pdfs },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.images && team.images.length > 0) {
    Image.updateMany(
      {
        _id: { $in: team.images },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.email_templates && team.email_templates.length > 0) {
    EmailTemplate.updateMany(
      {
        _id: { $in: team.email_templates },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

  if (team.automations && team.automations.length > 0) {
    Automation.updateMany(
      {
        _id: { $in: team.automations },
        role: 'team',
      },
      { $unset: { role: true } }
    );
  }

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

const removeVideos = async (req, res) => {
  const { currentUser } = req;
  const video = await Video.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!video) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }
  Team.updateOne(
    { videos: req.params.id },
    {
      $pull: { videos: mongoose.Types.ObjectId(req.params.id) },
    }
  ).catch((err) => {
    console.log('team remove video error', err.message);
  });

  Video.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const removePdfs = async (req, res) => {
  const { currentUser } = req;
  const pdf = await PDF.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!pdf) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }
  Team.updateOne(
    { pdfs: req.params.id },
    {
      $pull: { pdfs: mongoose.Types.ObjectId(req.params.id) },
    }
  ).catch((err) => {
    console.log('err', err.message);
  });

  PDF.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const removeImages = async (req, res) => {
  const { currentUser } = req;
  const image = await Image.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!image) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }
  Team.updateOne(
    { images: req.params.id },
    {
      $pull: { images: mongoose.Types.ObjectId(req.params.id) },
    }
  ).catch((err) => {
    console.log('err', err.message);
  });

  Image.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const removeAutomations = async (req, res) => {
  const { currentUser } = req;
  const automation = await Automation.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!automation) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }
  Team.updateOne(
    { automations: req.params.id },
    {
      $pull: { automations: mongoose.Types.ObjectId(req.params.id) },
    }
  ).catch((err) => {
    console.log('err', err.message);
  });

  Automation.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const removeEmailTemplates = async (req, res) => {
  const { currentUser } = req;
  const email_template = await EmailTemplate.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!email_template) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission',
    });
  }
  Team.updateOne(
    { email_templates: req.params.id },
    {
      $pull: { email_templates: mongoose.Types.ObjectId(req.params.id) },
    }
  ).catch((err) => {
    console.log('err', err.message);
  });

  EmailTemplate.updateOne(
    {
      _id: req.params.id,
      role: 'team',
    },
    { $unset: { role: true } }
  ).catch((err) => {
    console.log('err', err.message);
  });

  return res.send({
    status: true,
  });
};

const updateTeam = (req, res) => {
  const { team_id, data } = req.body;
  Team.updateOne({ _id: team_id }, { $set: data })
    .then(res.send({ status: true }))
    .catch((err) => {
      res.status(500).send({ status: false, error: err.message });
    });
};

const requestCall = async (req, res) => {
  const { currentUser } = req;
  let leader;
  let contacts;

  if (req.body.leader) {
    leader = await User.findOne({ _id: req.body.leader }).catch((err) => {
      console.log('leader find err', err.message);
    });
  }

  if (req.body.contacts && req.body.contacts.length > 0) {
    contacts = await Contact.find({ _id: { $in: req.body.contacts } }).catch(
      (err) => {
        console.log('contact find err', err.message);
      }
    );
  }

  const team_call = new TeamCall({
    user: currentUser.id,
    ...req.body,
  });

  team_call
    .save()
    .then((data) => {
      if (leader) {
        let guests = '';
        if (contacts) {
          for (let i = 0; i < contacts.length; i++) {
            if (contacts[i]) {
              const first_name = contacts[i].first_name || '';
              const last_name = contacts[i].last_name || '';
              const data = {
                first_name,
                last_name,
              };

              const new_activity = new Activity({
                team_calls: team_call.id,
                user: currentUser.id,
                contacts: contacts[i].id,
                content: 'inquire group call',
                type: 'team_calls',
              });

              new_activity.save().catch((err) => {
                console.log('activity save err', err.message);
              });

              Contact.updateOne(
                {
                  _id: contacts[i].id,
                },
                {
                  $set: { last_activity: new_activity.id },
                }
              ).catch((err) => {
                console.log('contact update err', err.message);
              });

              const guest = `<tr style="margin-bottom:10px;"><td><span class="icon-user">${getAvatarName(
                data
              )}</label></td><td style="padding-left:5px;">${first_name} ${last_name}</td></tr>`;
              guests += guest;
            }
          }
        }

        const organizer = `<tr><td><span class="icon-user">${getAvatarName({
          full_name: currentUser.user_name,
        })}</label></td><td style="padding-left: 5px;">${
          currentUser.user_name
        }</td></tr>`;

        const templatedData = {
          user_name: currentUser.user_name,
          leader_name: leader.user_name,
          created_at: moment().format('h:mm MMMM Do, YYYY'),
          subject: team_call.subject,
          description: team_call.description || '',
          organizer,
          call_url: urls.TEAM_CALLS + team_call.id,
          guests,
        };

        const params = {
          Destination: {
            ToAddresses: [leader.email],
          },
          Source: mail_contents.NO_REPLAY,
          Template: 'TeamCallRequest',
          TemplateData: JSON.stringify(templatedData),
          ReplyToAddresses: [currentUser.email],
        };

        // Create the promise and SES service object
        ses
          .sendTemplatedEmail(params)
          .promise()
          .then((response) => {
            console.log('success', response.MessageId);
          })
          .catch((err) => {
            console.log('ses send err', err);
          });
      }

      /** **********
       *  Creat dashboard notification to the inviated users
       *  */
      if (leader) {
        const notification = new Notification({
          user: leader.id,
          team_call: team_call.id,
          criteria: 'team_call_invited',
          content: `You've been invited to join a call by ${currentUser.user_name}.`,
        });

        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });
      }

      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      console.log('team save err', err.message);
      return res.status(400).json({
        status: false,
        error: err.message,
      });
    });
};

const acceptCall = async (req, res) => {
  const { currentUser } = req;
  const { call_id } = req.body;

  const team_call = await TeamCall.findOne({ _id: call_id })
    .populate('user')
    .catch((err) => {
      console.log('call find error', err.message);
    });

  if (team_call) {
    const user = team_call.user;
    TeamCall.updateOne(
      {
        _id: call_id,
      },
      {
        $set: {
          ...req.body,
          status: 'planned',
        },
      }
    )
      .then(() => {
        const contacts = team_call.contacts;
        for (let i = 0; i < team_call.length; i++) {
          const new_activity = new Activity({
            team_calls: team_call.id,
            user: currentUser.id,
            contacts: contacts[i],
            content: 'accepted a group call',
            type: 'team_calls',
          });

          new_activity.save().catch((err) => {
            console.log('activity save err', err.message);
          });

          Contact.updateOne(
            {
              _id: contacts[i],
            },
            {
              $set: { last_activity: new_activity.id },
            }
          ).catch((err) => {
            console.log('contact update err', err.message);
          });
        }

        const templatedData = {
          leader_name: currentUser.user_name,
          created_at: moment().format('h:mm MMMM Do, YYYY'),
          user_name: user.user_name,
          due_start: moment(team_call.due_start).format('h:mm MMMM Do, YYYY'),
          organizer: user.user_name,
          subject: team_call.subject,
          description: team_call.description,
        };

        const params = {
          Destination: {
            ToAddresses: [user.email],
          },
          Source: mail_contents.NO_REPLAY,
          Template: 'TeamCallInvitation',
          TemplateData: JSON.stringify(templatedData),
          ReplyToAddresses: [currentUser.email],
        };

        // Create the promise and SES service object

        ses.sendTemplatedEmail(params).promise();

        /** **********
         *  Creat dashboard notification to the inviated users
         *  */

        const notification = new Notification({
          user: user.id,
          team_call: call_id,
          criteria: 'team_call',
          content: `${currentUser.user_name} has accepted to join a call.`,
        });

        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });

        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('team update err', err.message);
      });
  }
};

const rejectCall = async (req, res) => {
  const { currentUser } = req;
  const { call_id } = req.body;

  const team_call = await TeamCall.findOne({ _id: call_id })
    .populate('user')
    .catch((err) => {
      console.log('call find error', err.message);
    });

  if (team_call) {
    const user = team_call.user;
    TeamCall.updateOne(
      {
        _id: call_id,
      },
      {
        status: 'canceled',
      }
    )
      .then(() => {
        /** **********
         *  Send email notification to the inviated users
         *  */
        const templatedData = {
          leader_name: currentUser.user_name,
          created_at: moment().format('h:mm MMMM Do YYYY'),
          team_call: team_call.subject,
          user_name: user.user_name,
          call_url: urls.TEAM_CALLS + team_call.id,
        };

        const params = {
          Destination: {
            ToAddresses: [user.email],
          },
          Source: mail_contents.NO_REPLAY,
          Template: 'TeamCallInquiryFailed',
          TemplateData: JSON.stringify(templatedData),
          ReplyToAddresses: [currentUser.email],
        };

        // Create the promise and SES service object

        ses.sendTemplatedEmail(params).promise();

        /** **********
         *  Creat dashboard notification to the inviated users
         *  */

        const notification = new Notification({
          user: user.id,
          team_call: call_id,
          criteria: 'team_call',
          content: `${currentUser.user_name} has rejected to join a call.`,
        });

        notification.save().catch((err) => {
          console.log('notification save err', err.message);
        });

        return res.send({
          status: true,
        });
      })
      .catch((err) => {
        console.log('team update err', err.message);
      });
  }
};

const getInquireCall = async (req, res) => {
  const { currentUser } = req;
  let id = 0;

  if (req.params.id) {
    id = parseInt(req.params.id);
  }

  const total = await TeamCall.countDocuments({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['pending'] },
  });

  const data = await TeamCall.find({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['pending'] },
  })
    .populate([
      {
        path: 'leader',
        select: { user_name: 1, picture_profile: 1, email: 1 },
      },
      { path: 'user', select: { user_name: 1, picture_profile: 1 } },
      // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
      { path: 'contacts' },
    ])
    .skip(id)
    .limit(8);

  return res.send({
    status: true,
    data,
    total,
  });
};

const getDetailInquireCall = async (req, res) => {
  const data = await TeamCall.findOne({
    _id: req.params.id,
  }).populate([
    { path: 'leader', select: { user_name: 1, picture_profile: 1 } },
    { path: 'user', select: { user_name: 1, picture_profile: 1 } },
    // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
    { path: 'contacts' },
  ]);

  return res.send({
    status: true,
    data,
  });
};

const getPlannedCall = async (req, res) => {
  const { currentUser } = req;
  let id = 0;
  if (req.params.id) {
    id = parseInt(req.params.id);
  }
  const data = await TeamCall.find({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['planned'] },
  })
    .populate([
      { path: 'leader', select: { user_name: 1, picture_profile: 1 } },
      { path: 'user', select: { user_name: 1, picture_profile: 1 } },
      // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
      { path: 'contacts' },
    ])
    .skip(id)
    .limit(8);

  const total = await TeamCall.countDocuments({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['planned'] },
  });

  return res.send({
    status: true,
    data,
    total,
  });
};

const getFinishedCall = async (req, res) => {
  const { currentUser } = req;
  let id = 0;
  if (req.params.id) {
    id = parseInt(req.params.id);
  }
  const data = await TeamCall.find({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['finished', 'canceled'] },
  })
    .populate([
      { path: 'leader', select: { user_name: 1, picture_profile: 1 } },
      { path: 'user', select: { user_name: 1, picture_profile: 1 } },
      // { path: 'guests', select: { user_name: 1, picture_profile: 1 } },
      { path: 'contacts' },
    ])
    .skip(id)
    .limit(8);

  const total = await TeamCall.countDocuments({
    $or: [
      { user: currentUser.id },
      { leader: currentUser.id },
      // { guests: currentUser.id },
    ],
    status: { $in: ['finished', 'canceled'] },
  });

  return res.send({
    status: true,
    data,
    total,
  });
};

const loadCalls = async (req, res) => {
  const { currentUser } = req;
  const { type, skip, count } = req.body;
  let query;
  switch (type) {
    case 'inquiry':
      query = {
        leader: currentUser.id,
        status: 'pending',
      };
      break;
    case 'sent':
      query = {
        user: currentUser.id,
        status: 'pending',
      };
      break;
    case 'scheduled':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['planned'] },
      };
      break;
    case 'completed':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['finished'] },
      };
      break;
    case 'canceled':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['canceled'] },
      };
      break;
    case 'denied':
      query = {
        $or: [{ user: currentUser.id }, { leader: currentUser.id }],
        status: { $in: ['declined'] },
      };
      break;
  }
  const data = await TeamCall.find(query)
    .populate([
      {
        path: 'leader',
        select: { user_name: 1, picture_profile: 1, email: 1 },
      },
      { path: 'user', select: { user_name: 1, picture_profile: 1, email: 1 } },
      { path: 'contacts' },
    ])
    .skip(skip)
    .limit(count || 10);

  const total = await TeamCall.countDocuments(query);

  return res.send({
    status: true,
    data,
    total,
  });
};

const updateCall = async (req, res) => {
  const { currentUser } = req;
  const team_call = await TeamCall.findOne({
    $or: [{ user: currentUser.id }, { leader: currentUser.id }],
    _id: req.params.id,
  });

  if (!team_call) {
    return res.status(400).json({
      status: false,
      error: 'Team call found err',
    });
  }
  TeamCall.updateOne(
    {
      _id: req.params.id,
    },
    {
      ...req.body,
    }
  )
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('team call update err', err.message);
      return res.send(500).json({
        status: false,
        error: err,
      });
    });
};

const removeCall = async (req, res) => {
  const { currentUser } = req;
  TeamCall.deleteOne({
    _id: req.params.id,
    $or: [{ user: currentUser.id }, { leader: currentUser.id }],
  })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      console.log('team call delte err', err.message);
      return res.send(500).json({
        status: false,
        error: err,
      });
    });
};

const getLeaders = (req, res) => {
  const { currentUser } = req;
  Team.find({
    $or: [
      {
        members: currentUser.id,
      },
      { owner: currentUser.id },
    ],
  })
    .populate([
      {
        path: 'owner',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          cell_phone: 1,
        },
      },
      {
        path: 'editors',
        select: {
          _id: 1,
          user_name: 1,
          picture_profile: 1,
          email: 1,
          cell_phone: 1,
        },
      },
    ])
    .then((data) => {
      let users = [];
      data.forEach((e) => {
        if (users.length) {
          users = [...users, ...e.editors, ...e.owner];
        } else {
          users = [...e.editors, ...e.owner];
        }
      });
      return res.send({
        status: true,
        data: users,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message,
      });
    });
};

const getSharedContacts = async (req, res) => {
  const { currentUser } = req;
  const count = req.body.count || 50;
  const skip = req.body.skip || 0;

  const total = await Contact.countDocuments({
    $or: [
      {
        shared_contact: true,
        user: currentUser.id,
        shared_team: req.body.team,
      },
      {
        shared_members: currentUser.id,
        shared_team: req.body.team,
      },
    ],
  });

  const contacts = await Contact.find({
    $or: [
      {
        shared_members: currentUser.id,
        shared_team: req.body.team,
      },
      {
        shared_contact: true,
        user: currentUser.id,
        shared_team: req.body.team,
      },
    ],
  })
    .populate([
      {
        path: 'user',
        select: 'user_name email picture_profile cell_phone',
      },
      {
        path: 'last_activity',
      },
      {
        path: 'shared_members',
        select: 'user_name email picture_profile cell_phone',
      },
    ])
    .skip(skip)
    .limit(count)
    .catch((err) => {
      console.log('get shared contact', err.message);
    });

  return res.send({
    status: true,
    data: {
      count: total,
      contacts,
    },
  });
};

const searchContact = async (req, res) => {
  const { currentUser } = req;
  const searchStr = req.body.search;
  const search = searchStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
  const phoneSearch = searchStr.replace(/[.*+\-?^${}()|[\]\\\s]/g, '');
  let contacts = [];
  if (search.split(' ').length > 1) {
    contacts = await Contact.find({
      $or: [
        {
          first_name: { $regex: search.split(' ')[0], $options: 'i' },
          last_name: { $regex: search.split(' ')[1], $options: 'i' },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          first_name: { $regex: search.split(' ')[0], $options: 'i' },
          last_name: { $regex: search.split(' ')[1], $options: 'i' },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
        {
          first_name: { $regex: search, $options: 'i' },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          first_name: { $regex: search, $options: 'i' },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
        {
          last_name: { $regex: search, $options: 'i' },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          last_name: { $regex: search, $options: 'i' },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
      ],
    })
      .populate([
        {
          path: 'user',
          select: 'user_name email picture_profile cell_phone',
        },
        {
          path: 'last_activity',
        },
        {
          path: 'shared_members',
          select: 'user_name email picture_profile cell_phone',
        },
      ])
      .sort({ first_name: 1 });
  } else {
    contacts = await Contact.find({
      $or: [
        {
          first_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          first_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
        {
          email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          email: { $regex: '.*' + search.split(' ')[0] + '.*', $options: 'i' },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
        {
          last_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          last_name: { $regex: search.split(' ')[0] + '.*', $options: 'i' },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          user: currentUser.id,
          shared_team: req.body.team,
          shared_contact: true,
        },
        {
          cell_phone: {
            $regex: '.*' + phoneSearch + '.*',
            $options: 'i',
          },
          shared_members: currentUser.id,
          shared_team: req.body.team,
        },
      ],
    })
      .populate([
        {
          path: 'user',
          select: 'user_name email picture_profile cell_phone',
        },
        {
          path: 'last_activity',
        },
        {
          path: 'shared_members',
          select: 'user_name email picture_profile cell_phone',
        },
      ])
      .sort({ first_name: 1 });
  }

  return res.send({
    status: true,
    data: {
      contacts,
      search,
    },
  });
};

const loadMaterial = async (req, res) => {
  const { currentUser } = req;
  const team = await Team.findOne({ _id: req.params.id }).catch((err) => {
    console.log('team find err', err.message);
  });

  const video_data = [];
  const pdf_data = [];
  const image_data = [];

  if (team.videos && team.videos.length > 0) {
    const video_ids = team.videos;
    for (let i = 0; i < video_ids.length; i++) {
      const video = await Video.findOne({
        _id: video_ids[i],
      }).catch((err) => {
        console.log('video find err', err.message);
      });

      if (video) {
        const views = await VideoTracker.countDocuments({
          video: video_ids[i],
          user: currentUser.id,
        });

        const video_detail = {
          ...video._doc,
          views,
          material_type: 'video',
        };

        video_data.push(video_detail);
      }
    }
  }

  if (team.pdfs && team.pdfs.length > 0) {
    const pdf_ids = team.pdfs;
    for (let i = 0; i < pdf_ids.length; i++) {
      const pdf = await PDF.findOne({
        _id: pdf_ids[i],
      }).catch((err) => {
        console.log('pdf find err', err.message);
      });

      if (pdf) {
        const views = await PDFTracker.countDocuments({
          pdf: pdf_ids[i],
          user: currentUser.id,
        });

        const pdf_detail = {
          ...pdf._doc,
          views,
          material_type: 'pdf',
        };

        pdf_data.push(pdf_detail);
      }
    }
  }

  if (team.images && team.images.length > 0) {
    const image_ids = team.images;
    for (let i = 0; i < image_ids.length; i++) {
      const image = await Image.findOne({
        _id: image_ids[i],
      }).catch((err) => {
        console.log('image find err', err.message);
      });

      if (image) {
        const views = await ImageTracker.countDocuments({
          image: image_ids[i],
          user: currentUser.id,
        });

        const image_detail = {
          ...image._doc,
          views,
          material_type: 'image',
        };

        image_data.push(image_detail);
      }
    }
  }

  return res.send({
    status: true,
    data: {
      video_data,
      pdf_data,
      image_data,
    },
  });
};

const loadAutomation = async (req, res) => {
  const { currentUser } = req;
  const team = await Team.findOne({ _id: req.params.id }).catch((err) => {
    console.log('team find err', err.message);
  });

  const data = [];
  // get shared contacts first
  const shared_contacts = await Contact.find({
    shared_members: currentUser.id,
  });

  if (team.automations && team.automations.length > 0) {
    const automation_ids = team.automations;
    for (let i = 0; i < automation_ids.length; i++) {
      const automation = await Automation.findOne({
        _id: automation_ids[i],
      }).catch((err) => {
        console.log('automation find err', err.message);
      });

      if (automation) {
        const total = await TimeLine.aggregate([
          {
            $match: {
              $or: [
                {
                  user: mongoose.Types.ObjectId(currentUser._id),
                  automation: mongoose.Types.ObjectId(automation._id),
                },
                {
                  contact: { $in: shared_contacts },
                  automation: mongoose.Types.ObjectId(automation._id),
                },
              ],
            },
          },
          {
            $group: {
              _id: { contact: '$contact' },
            },
          },
          {
            $group: {
              _id: '$_id.contact',
            },
          },
          {
            $project: { _id: 1 },
          },
          {
            $count: 'count',
          },
        ]);

        let automation_detail;

        if (automation._doc) {
          automation_detail = {
            ...automation._doc,
            contacts: total[0] ? total[0].count : 0,
          };
        } else {
          automation_detail = {
            ...automation,
            contacts: total[0] ? total[0].count : 0,
          };
        }

        data.push(automation_detail);
      }
    }
  }

  return res.send({
    status: true,
    data,
  });
};

const loadTemplate = async (req, res) => {
  const team = await Team.findOne({
    _id: req.params.id,
  })
    .populate('email_templates')
    .catch((err) => {
      console.log('team load err', err.message);
    });

  return res.send({
    status: true,
    data: team.email_templates,
  });
};

const getAllSharedContacts = async (req, res) => {
  const { currentUser } = req;

  const contacts = await Contact.find({
    $or: [
      {
        shared_members: currentUser.id,
        shared_team: req.body.team,
      },
      {
        shared_contact: true,
        user: currentUser.id,
        shared_team: req.body.team,
      },
    ],
  }).select({
    _id: 1,
    first_name: 1,
    last_name: 1,
    email: 1,
    cell_phone: 1,
  });
  return res.send({
    status: true,
    data: contacts,
  });
};

module.exports = {
  getAll,
  getLeaders,
  getTeam,
  loadMaterial,
  loadAutomation,
  loadTemplate,
  getSharedContacts,
  getAllSharedContacts,
  searchContact,
  getInvitedTeam,
  get,
  getInquireCall,
  getPlannedCall,
  getFinishedCall,
  getDetailInquireCall,
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
  removeVideos,
  removePdfs,
  removeImages,
  removeAutomations,
  removeEmailTemplates,
  requestTeam,
  requestCall,
  acceptCall,
  rejectCall,
  updateCall,
  removeCall,
  updateTeam,
  loadCalls,
};
