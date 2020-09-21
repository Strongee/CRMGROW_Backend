const MaterialTheme = require('../models/material_theme');
const { uploadBase64Image } = require('../helpers/fileUpload');

const get = async (req, res) => {
  const material_theme = await MaterialTheme.findOne({
    _id: req.params.id,
  });

  return res.send({
    status: true,
    data: material_theme,
  });
};

const getAll = (req, res) => {
  const { currentUser } = req;

  MaterialTheme.find({
    $or: [
      {
        user: currentUser.id,
      },
      { role: 'admin' },
    ],
  })
    .then((data) => {
      return res.send({
        status: true,
        data,
      });
    })
    .catch((err) => {
      console.log('material found error', err.message);
    });
};

const create = async (req, res) => {
  const { currentUser } = req;
  let thumbnail;
  if (req.body.thumbnail) {
    thumbnail = await uploadBase64Image(req.body.thumbnail, 'theme');
  }

  const material_template = new MaterialTheme({
    user: currentUser.id,
    thumbnail,
    ...req.body,
  });

  material_template.save().catch((err) => {
    console.log('material theme save err', err.message);
  });

  return res.send({
    status: true,
  });
};

const update = async (req, res) => {
  MaterialTheme.updateOne(
    { _id: req.params.id },
    { $set: { ...req.body } }
  ).catch((err) => {
    console.log('material theme update error', err.emssage);
  });
  return res.send({
    status: true,
  });
};

module.exports = {
  get,
  create,
  getAll,
  update,
};
