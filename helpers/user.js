const User = require('../models/user');
const system_settings = require('../config/system_settings');

const setPackage = async (data) => {
  const { user, level } = data;
  const query = {};

  // contact info
  const contact_info = {
    'contact_info.max_count': system_settings.CONTACT_UPLOAD_LIMIT[level],
  };

  query.contact = contact_info;

  User.updateOne(
    {
      _id: user.id,
    },
    {
      $set: query,
    }
  );
};

module.exports = {
  setPackage,
};
