const { validationResult } = require('express-validator/check');
const Label = require('../models/label');
const garbageHelper = require('../helpers/garbage.js');

const create = async (req, res) => {
  const { currentUser } = req;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array(),
    });
  }

  const label = new Label({
    ...req.body,
    user: currentUser.id,
  });

  try {
    const newLabel = await label.save();
    return res.send({ status: true, data: newLabel });
  } catch (err) {
    return res.status(500).send({
      status: false,
      error: err.message || 'Label creating failed.',
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  const garbage = await garbageHelper.get(currentUser);

  if (!garbage) {
    return res.status(400).send({
      status: false,
      error: `Couldn't get the Garbage`,
    });
  }

  let editedLabels = [];
  if (garbage && garbage['edited_label']) {
    editedLabels = garbage['edited_label'];
  }

  const company = currentUser.company || 'eXp Realty';
  const _label_list = await Label.find({
    user: currentUser.id,
    del: false,
  }).sort({ priority: 1 });

  const _label_admin = await Label.find({
    role: 'admin',
    _id: { $nin: editedLabels },
  }).sort({ priority: 1 });

  Array.prototype.push.apply(_label_list, _label_admin);

  if (!_label_list) {
    return res.status(400).json({
      status: false,
      error: 'Label doesn`t exist',
    });
  } else {
    res.send({
      status: true,
      data: _label_list,
    });
  }
};

const update = async (req, res) => {
  const data = req.body;
  const { currentUser } = req;
  try {
    const label = await Label.findOne({
      user: currentUser.id,
      _id: req.params.id,
    });
    if (label) {
      Label.updateMany({ _id: req.params.id }, { $set: data })
        .then(() => {
          res.send({
            status: true,
          });
        })
        .catch((err) => {
          res.status(500).json({
            status: false,
            error: err.message,
          });
        });
    } else {
      res.status(400).send({
        status: false,
        error: "Label doesn't exist.",
      });
    }
  } catch (err) {
    res.status(500).send({
      status: false,
      error: 'Internal server error.',
    });
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;
  try {
    const label = await Label.findOne({
      user: currentUser.id,
      _id: req.params.id,
    });

    if (label) {
      await Label.deleteOne({ _id: req.params.id });
      return res.send({
        status: true,
      });
    } else {
      res.status(404).send({
        status: false,
        error: 'Label not found.',
      });
    }
  } catch (err) {
    res.status(500).send({
      status: false,
      error: 'Internal server error.',
    });
  }
};

module.exports = {
  create,
  getAll,
  update,
  remove,
};
