const User = require('../models/user');
const system_settings = require('../config/system_settings');

const setPackage = async (data) => {
  const { user, level } = data;

  // contact info
  const contact_info = {
    'contact_info.max_count': system_settings.CONTACT_UPLOAD_LIMIT[level],
  };

  let material_info;
  let automation_info;
  let calendar_info;
  let text_info;
  let assist_info;
  let capture_enabled;
  let link_track_enabled;

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

  if (level === 'LITE') {
    automation_info = {
      'automation_info.is_enabled': false,
    };

    calendar_info = {
      'calendar_info.is_enabled': false,
    };

    text_info = {
      'text_info.is_enabled': false,
    };

    assist_info = {
      'assistant_info.is_enabled': false,
    };
  } else {
    automation_info = {
      'automation_info.max_count':
        system_settings.AUTOMATION_ASSIGN_LIMIT[level],
    };

    calendar_info = {
      'calendar_info.max_count': system_settings.CALENDAR_LIMIT[level],
    };

    text_info = {
      'text_info.max_count': system_settings.TEXT_MONTHLY_LIMIT[level],
    };

    assist_info = {
      'assistant_info.max_count': system_settings.ASSISTANT_LIMIT[level],
    };
    capture_enabled = false;
    link_track_enabled = false;
  }

  const query = {
    ...contact_info,
    ...material_info,
    ...automation_info,
    ...calendar_info,
    ...text_info,
    ...assist_info,
    capture_enabled,
    link_track_enabled,
  };

  console.log('query', query);

  User.updateOne(
    {
      _id: user,
    },
    {
      $set: query,
    }
  );
};

module.exports = {
  setPackage,
};
