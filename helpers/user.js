const User = require('../models/user');
const system_settings = require('../config/system_settings');

const setPackage = async (data) => {
  const { user, level } = data;

  console.log('level', level);
  console.log(
    'system_settings.CONTACT_UPLOAD_LIMIT[level]',
    system_settings.CONTACT_UPLOAD_LIMIT[level]
  );

  // contact info
  const contact_info = {
    'contact_info.max_count': system_settings.CONTACT_UPLOAD_LIMIT[level],
  };

  let material_info;
  let automation_info;

  if (level === 'ELITE') {
    material_info = {
      'material_info.is_limit': false,
    };
  } else {
    material_info = {
      'material_info.upload_max_count':
        system_settings.MATERIAL_UPLOAD_LIMIT[level],
      'material_info.record_max_duration':
        system_settings.VIDEO_RECORD_LIMIT[level],
    };
  }

  if (level === 'BASIC') {
    automation_info = {
      'automation_info.is_enabled': false,
    };
  } else {
    automation_info = {
      'automation_info.max_count':
        system_settings.AUTOMATION_ASSIGN_LIMIT[level],
    };
  }

  const query = {
    ...contact_info,
    ...material_info,
    ...automation_info,
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
