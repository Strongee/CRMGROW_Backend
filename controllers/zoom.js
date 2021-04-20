const request = require('request-promise');
const { createMeeting, refreshToken } = require('../helpers/zoom');

const create = async (req, res) => {
  const options = {
    method: 'POST',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: {
      topic: 'This is new test',
      start_time: new Date(),
      type: 2,
      agenda: 'This is a meeting with a Super',
      duration: 30,
    },
    json: true,
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

const update = async (req, res) => {
  var options = {
    method: 'PUT',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization: 'Bearer ' + ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: {
      topic: 'This is new test',
      start_time: new Date(),
      type: 2,
      agenda: 'This is a meeting with a Super',
      duration: 30,
    },
    json: true,
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

module.exports = {
  create,
  update,
};
