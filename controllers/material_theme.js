const MaterialTheme = require('../models/material_theme');
const { uploadBase64Image, downloadFile } = require('../helpers/fileUpload');
const urls = require('../constants/urls');
const api = require('../config/api');

const get = async (req, res) => {
  const material_theme = await MaterialTheme.findOne({
    _id: req.params.id,
  }).catch((err) => {
    console.log('material theme err', err.message);
  });

  let json_content;
  if (material_theme.role !== 'admin') {
    const key = material_theme.json_content.slice(urls.STORAGE_BASE.length + 1);
    const data = await downloadFile(key);
    json_content = JSON.parse(Buffer.from(data.Body).toString('utf8'));
  }

  const myJSON = JSON.stringify(material_theme);
  const data = JSON.parse(myJSON);
  return res.send({
    status: true,
    data: {
      ...data,
      json_content,
      project_id: api.UNLAYER.PROJECT_ID,
    },
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
