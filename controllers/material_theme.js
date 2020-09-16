const MaterialTheme = require('../models/material_theme');

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
    user: currentUser.id,
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

module.exports = {
  get,
  getAll,
};
