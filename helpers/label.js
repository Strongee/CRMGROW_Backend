const Garbage = require('../models/garbage');
const Label = require('../models/label');

const getAll = async (user) => {
  const garbage = await Garbage.findOne({ user });

  let editedLabels = [];
  if (garbage && garbage['edited_label']) {
    editedLabels = garbage['edited_label'];
  }

  const _label_list = await Label.find({ user }).select({
    name: 1,
  });

  const _label_admin = await Label.find({
    role: 'admin',
    _id: { $nin: editedLabels },
  }).select({ name: 1 });

  Array.prototype.push.apply(_label_list, _label_admin);
  console.log('label_list', _label_list);
  return _label_list;
};

const convertLabel = async(label_str) => {
}

module.exports = {
  getAll,
};
