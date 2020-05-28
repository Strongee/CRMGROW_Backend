const { validationResult } = require("express-validator/check");
const Label = require("../models/label");

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
    updated_at: new Date(),
    created_at: new Date(),
  });

  try {
    const newLabel = await label.save();
    return res.send({ status: true, data: newLabel });
  } catch (err) {
    return res.status(500).send({
      status: false,
      error: err.message || "Label creating failed.",
    });
  }
};

const getAll = async (req, res) => {
  const { currentUser } = req;
  try {
    const data = await Label.find({ user: currentUser.id });
    if (!data) {
      return res.status(400).json({
        status: false,
        error: "Label doesn`t exist",
      });
    } else {
      res.send({
        status: true,
        data,
      });
    }
  } catch (err) {
    res.status(500).send({
      status: false,
      error: err.message || "Internal server error.",
    });
  }
};

const update = async (req, res) => {
  const data = req.body;
  const { currentUser } = req;
  console.log(data, "DATAAAAAA");
  try {
    let label = await Label.findOne({
      user: currentUser.id,
      _id: req.params.id,
    });
    console.log(label, "LABEEEEEEL");
    if (label) {
      if (label.user._id != currentUser.id) {
        return res.status(400).send({
          status: false,
          error: "This is not your label so couldn't update.",
        });
      } else {
        await Label.find({ _id: req.params.id }).update({ $set: data });
        res.send({
          status: true,
        });
      }
    } else {
      res.status(400).send({
        status: false,
        error: "Label doesn't exist.",
      });
    }
  } catch (err) {
    res.status(500).send({
      status: false,
      error: "Internal server error.",
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
        error: "Label not found.",
      });
    }
  } catch (err) {
    res.status(500).send({
      status: false,
      error: "Internal server error.",
    });
  }
};

module.exports = {
  create,
  getAll,
  update,
  remove,
};
