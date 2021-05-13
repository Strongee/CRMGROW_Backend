const User = require('../models/user');
const system_settings = require('../config/system_settings');

const setPackage = async (data) => {
  const { user, level } = data;

  // contact info
  const contact_info = {
    'contact_info.max_count': system_settings.CONTACT_UPLOAD_LIMIT[level],
  };

  const video_info = {
    'video_info.upload_max_count': system_settings.VIDEO_UPLOAD_LIMIT[level],
    'video_info.record_max_duration': system_settings.VIDEO_RECORD_LIMIT[level],
  };

  const query = {
    ...contact_info,
    ...video_info,
  };

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
