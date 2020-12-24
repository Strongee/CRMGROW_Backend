const mongoose = require('mongoose');
const Automation = require('../models/automation');
const TimeLine = require('../models/time_line');
const Contact = require('../models/contact');
const Video = require('../models/video');
const Team = require('../models/team');
const garbageHelper = require('../helpers/garbage');

const get = (req, res) => {
  const { id } = req.params;

  Automation.findOne({ _id: id })
    .then((data) => {
      res.send({
        status: false,
        data,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Automation reading is failed.',
      });
    });
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';
  const automations = await Automation.find({
    user: currentUser.id,
    del: false,
  });

  const _automation_admin = await Automation.find({
    role: 'admin',
    company,
    del: false,
  });

  Array.prototype.push.apply(automations, _automation_admin);

  const teams = await Team.find({ members: currentUser.id }).populate(
    'automations'
  );

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      Array.prototype.push.apply(automations, team.automations);
    }
  }

  if (!automations) {
    return res.status(400).json({
      status: false,
      error: 'Automation doesn`t exist',
    });
  }
  const automation_array = [];

  for (let i = 0; i < automations.length; i++) {
    const automation = automations[i];
    const contacts = await TimeLine.aggregate([
      {
        $match: {
          $and: [
            {
              user: mongoose.Types.ObjectId(currentUser._id),
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
    ]);
    const myJSON = JSON.stringify(automation);
    const data = JSON.parse(myJSON);
    const automation_detail = await Object.assign(data, { contacts });

    automation_array.push(automation_detail);
  }

  return res.send({
    status: true,
    data: automation_array,
  });
};

const getStatus = async (req, res) => {
  const { id } = req.params;
  const { contacts } = req.body;
  const assignedContacts = await Contact.find(
    { _id: { $in: contacts } },
    '_id first_name last_name email cell_phone'
  ).catch((err) => {
    console.log('Error', err);
  });
  TimeLine.find({ automation: id })
    .populate()
    .then((data) => {
      res.send({
        status: true,
        data: {
          timelines: data,
          contacts: assignedContacts,
        },
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Automation reading is failed.',
      });
    });
};

const getPage = async (req, res) => {
  const { currentUser } = req;
  const { page } = req.params;

  const garbage = await garbageHelper.get(currentUser);
  // let editedAutomations = [];
  // if(garbage) {
  //     editedAutomations = garbage['edited_automation']
  // }

  const team_automations = [];
  const teams = await Team.find({ members: currentUser.id });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.automations) {
        Array.prototype.push.apply(team_automations, team.automations);
      }
    }
  }

  const automations = await Automation.find({
    $or: [
      { user: currentUser.id },
      { role: 'admin' },
      { _id: { $in: team_automations } },
    ],
  })
    .skip((page - 1) * 10)
    .limit(10);
  const automation_array = [];
  for (let i = 0; i < automations.length; i++) {
    const automation = automations[i];
    const contacts = await TimeLine.aggregate([
      {
        $match: {
          $and: [
            {
              user: mongoose.Types.ObjectId(currentUser._id),
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
    ]);
    const myJSON = JSON.stringify(automation);
    const data = JSON.parse(myJSON);
    const automation_detail = await Object.assign(data, { contacts });

    automation_array.push(automation_detail);
  }

  const total = await Automation.countDocuments({
    $or: [{ user: currentUser.id }, { role: 'admin' }],
  });

  return res.json({
    status: true,
    data: automation_array,
    total,
  });
};

const create = (req, res) => {
  const { currentUser } = req;
  const automation = new Automation({
    ...req.body,
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  automation
    .save()
    .then((_automation) => {
      res.send({
        status: true,
        data: _automation,
      });
    })
    .catch((err) => {
      res.status(500).send({
        status: false,
        error: err.message || 'Automation creating is failed.',
      });
    });
};

const update = async (req, res) => {
  const { currentUser } = req;
  const id = req.params.id;
  const data = req.body;
  let automation = await Automation.findOne({ _id: id });
  automation = JSON.parse(JSON.stringify(automation));

  if (automation) {
    if (automation.user !== currentUser.id) {
      if (automation.role === 'admin') {
        return res.status(400).send({
          status: false,
          error: `couldn't update admin automation`,
        });
      }
      return res.status(400).send({
        status: false,
        error: `This is not your automation so couldn't update.`,
      });
    }
  } else {
    return res.status(400).send({
      status: false,
      error: `Automation doesn't exist`,
    });
  }
  Automation.updateOne({ _id: id }, { $set: data })
    .then(() => {
      res.send({
        status: true,
      });
    })
    .catch((err) => {
      res.status(400).send({
        status: false,
        error: err.message || 'Automation Updating is failed.',
      });
    });
};

const remove = async (req, res) => {
  const { currentUser } = req;
  const automation = await Automation.findOne({
    _id: req.params.id,
    user: currentUser.id,
  });

  if (!automation) {
    return res.status(400).send({
      status: false,
      error: 'Invalid permission.',
    });
  }

  if (automation.role === 'team') {
    Team.updateOne(
      { automations: req.params.id },
      {
        $pull: { automations: { $in: [req.params.id] } },
      }
    );
  }

  Automation.deleteOne({ _id: req.params.id })
    .then(() => {
      return res.send({
        status: true,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: false,
        error: err.message || 'Automation Removing is failed.',
      });
    });
};

const search = async (req, res) => {
  const condition = req.body;
  const { currentUser } = req;
  const company = currentUser.company || 'eXp Realty';

  const team_automations = [];
  const teams = await Team.find({ members: currentUser.id });

  if (teams && teams.length > 0) {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      if (team.automations) {
        Array.prototype.push.apply(team_automations, team.automations);
      }
    }
  }

  Automation.find({
    $and: [
      {
        $or: [
          { user: currentUser.id },
          { role: 'admin', company },
          { _id: { $in: team_automations } },
        ],
      },
      {
        title: { $regex: `.*${condition.search}.*`, $options: 'i' },
      },
    ],
  })
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      return res.status(400).send({
        status: false,
      });
    });
};

const updateDefault = async (req, res) => {
  const { automation, id } = req.body;
  let thumbnail;
  const { currentUser } = req;

  const defaultAutomation = await Video.findOne({
    _id: id,
    role: 'admin',
  }).catch((err) => {
    console.log('err', err);
  });
  if (!defaultAutomation) {
    return res.status(400).json({
      status: false,
      error: 'This Default automation not exists',
    });
  }
  // Update Garbage
  const garbage = await garbageHelper.get(currentUser);
  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }
  if (garbage.edited_automation) {
    garbage.edited_automation.push(id);
  } else {
    garbage.edited_automation = [id];
  }

  await garbage.save().catch((err) => {
    return res.status.json({
      status: false,
      error: 'Update Garbage Error.',
    });
  });

  for (const key in automation) {
    defaultAutomation[key] = automation[key];
  }
  if (thumbnail) {
    defaultAutomation.thumbnail = thumbnail;
  }

  defaultAutomation.updated_at = new Date();
  const defaultAutomationJSON = JSON.parse(JSON.stringify(defaultAutomation));
  delete defaultAutomationJSON._id;
  delete defaultAutomationJSON.role;
  const newAutomation = new Automation({
    ...defaultAutomationJSON,
    user: currentUser._id,
    default_edited: true,
  });
  const _automation = await newAutomation
    .save()
    .then()
    .catch((err) => {
      console.log('err', err);
    });

  return res.send({
    status: true,
    data: _automation,
  });
};

const loadOwn = async (req, res) => {
  console.log('Load OWN');
  const { currentUser } = req;

  const automations = await Automation.find({
    $and: [{ user: currentUser.id }, { role: { $ne: 'admin' } }],
  });

  return res.json({
    status: true,
    data: automations,
  });
};

const getEasyLoad = async (req, res) => {
  const { currentUser } = req;
  const automations = await Automation.find({
    $or: [
      {
        user: mongoose.Types.ObjectId(currentUser.id),
      },
      {
        role: 'admin',
      },
      {
        shared_members: currentUser.id,
      },
    ],
  });

  return res.send({
    status: true,
    data: automations,
  });
};

module.exports = {
  get,
  getAll,
  getStatus,
  getPage,
  getEasyLoad,
  create,
  update,
  remove,
  updateDefault,
  search,
  loadOwn,
};
