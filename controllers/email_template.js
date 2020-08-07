const mongoose = require('mongoose');
const EmailTemplate = require('../models/email_template');
const Team = require('../models/team');

const get = async (req, res) => {
  const { id } = req.params;

  const data = await EmailTemplate.findOne({ _id: id });
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist',
    });
  }

  res.send({
    status: true,
    data,
  });
};

const getTemplates = async (req, res) => {
  const { currentUser } = req;
  const { page } = req.params;
  const team_templates = [];
  const teams = await Team.find({ members: currentUser.id });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.email_templates) {
        Array.prototype.push.apply(team_templates, team.email_templates);
      }
    }
  }

  const templates = await EmailTemplate.find({
    $or: [
      { user: currentUser.id },
      { role: 'admin' },
      { _id: { $in: team_templates } },
    ],
  })
    .skip((page - 1) * 10)
    .limit(10);

  const total = await EmailTemplate.countDocuments({
    $or: [{ user: currentUser.id }, { role: 'admin' }],
  });
  return res.json({
    status: true,
    data: templates,
    total,
  });
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';

  const email_templates = await EmailTemplate.find({
    user: currentUser.id,
  });

  const _template_admin = await EmailTemplate.find({
    role: 'admin',
    company,
  });

  Array.prototype.push.apply(email_templates, _template_admin);

  const teams = await Team.find({ members: currentUser.id }).populate(
    'email_templates'
  );

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(email_templates, team.email_templates);
    }
  }

  if (!email_templates) {
    return res.status(400).json({
      status: false,
      error: 'Templates doesn`t exist',
    });
  }

  return res.send({
    status: true,
    data: email_templates,
  });
};

const create = async (req, res) => {
  const { currentUser } = req;
  // const errors = validationResult(req)
  // if (!errors.isEmpty()) {
  //   return res.status(400).json({
  //     status: false,
  //     error: errors.array()
  //   })
  // }

  const template = new EmailTemplate({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  });

  await template.save();
  return res.send({
    status: true,
  });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const { id } = req.params;
  EmailTemplate.find({ _id: id, user: currentUser.id })
    .updateOne({ $set: { ...req.body } })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Update Error',
      });
    });
};

const remove = async (req, res) => {
  const { id } = req.params;
  const { currentUser } = req;
  const email_template = await EmailTemplate.findOne({ 
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!email_template) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission.',
    });
  }

  if (email_template.role === 'team') {
    Team.updateOne(
      { email_templates: req.params.id },
      {
        $pull: { email_templates: { $in: [req.params.id] } },
      }
    );
  }

  EmailTemplate.deleteOne({ _id: id, user: currentUser.id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Remove Template Error',
      });
    });
};

const bulkRemove = (req, res) => {
  const { ids } = req.body;
  const { currentUser } = req;
  EmailTemplate.deleteMany({ _id: { $in: ids }, user: currentUser.id })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Remove Template Error',
      });
    });
};

const search = async (req, res) => {
  const { currentUser } = req;
  const str = req.query.q;
  const option = { ...req.body };

  const team_templates = [];
  const teams = await Team.find({ members: currentUser.id });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.email_templates) {
        Array.prototype.push.apply(team_templates, team.email_templates);
      }
    }
  }

  const templates = await EmailTemplate.find({
    $and: [
      option,
      {
        $or: [
          { title: { $regex: `.*${str}.*`, $options: 'i' } },
          { subject: { $regex: `.*${str}.*`, $options: 'i' } },
          { content: { $regex: `.*${str}.*`, $options: 'i' } },
        ],
      },
      {
        $or: [
          { user: currentUser.id },
          { role: 'admin' },
          { _id: { $in: team_templates } },
        ],
      },
    ],
  });

  return res.send({
    status: true,
    data: templates,
  });
};

const loadOwn = async (req, res) => {
  const { currentUser } = req;

  const templates = await EmailTemplate.find({
    $and: [{ user: currentUser.id }, { role: { $ne: 'admin' } }],
  });
  return res.json({
    status: true,
    data: templates,
  });
};

module.exports = {
  create,
  get,
  getAll,
  update,
  remove,
  getTemplates,
  bulkRemove,
  search,
  loadOwn,
};
