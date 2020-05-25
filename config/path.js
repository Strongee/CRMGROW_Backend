/*
  For Linux
*/
// module.exports.FILES_PATH = '/var/www/teamgrow/files/';
// module.exports.THUMBNAILS_PATH = '/var/www/teamgrow/thumbnails/';
// module.exports.GIF_PATH = '/var/www/teamgrow/gif/';
// module.exports.PREVIEW_PATH = '/var/www/teamgrow/previews/';
// module.exports.TEMP_PATH = '/var/www/teamgrow/temp/';
// module.exports.VIDEO_PATH = '/var/www/teamgrow/video/';
// module.exports.VIDEO_CONVERT_LOG_PATH = '/var/www/teamgrow/video_log/';
// module.exports.ENV_PATH = '../.env';
// module.exports.TRAKER_PATH = '/var/www/teamgrow/backend_admin/tracker.jpg';
// module.exports.PLAY_BUTTON_PATH =
//   '/var/www/teamgrow/backend_admin/play-button.png';

/*
  For Windows, Azure
*/
// module.exports.FILES_PATH = '../files/';
// module.exports.THUMBNAILS_PATH = '../thumbnails/';
// module.exports.GIF_PATH = '../gif/';
// module.exports.PREVIEW_PATH = '../previews/';
// module.exports.TEMP_PATH = '../temp/';
// module.exports.VIDEO_PATH = '../video/';
// module.exports.ENV_PATH = '../teamgrow_env';
// module.exports.TRAKER_PATH = './tracker.jpg';

/* For Mac */
const path = require('path');

module.exports.FILES_PATH = path.join(__dirname, '..', 'files');
module.exports.THUMBNAILS_PATH = path.join(__dirname, '..', 'thumbnails');
module.exports.GIF_PATH = path.join(__dirname, '..', 'thumbnails');
module.exports.PREVIEW_PATH = path.join(__dirname, '..', 'previews');
module.exports.TEMP_PATH = path.join(__dirname, '..', 'temp');
module.exports.VIDEO_PATH = path.join(__dirname, '..', 'video');
module.exports.ENV_PATH = path.join(__dirname, '..', 'teamgrow_env');
module.exports.TRAKER_PATH = path.join(__dirname, '..', 'tracker.jpg');
