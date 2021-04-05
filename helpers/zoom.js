const request = require('request-promise');

const api = require('../config/api');
const urls = require('../constants/urls');

const requestAuth = () => {
  var options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    qs: {
      grant_type: 'authorization_code',
      // The code below is a sample authorization code. Replace it with your actual authorization code while making requests.
      code: 'kG9gumOxrl_8nGKq1IyRWCIda5_7Vmycw',
      // The uri below is a sample redirect_uri. Replace it with your actual redirect_uri while making requests.
      redirect_uri:
        'http://teamgrow-staticsite-green.s3-website-us-west-1.amazonaws.com/profile/zoom',
    },
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization:
        'Basic ' +
        Buffer.from(api.CLIENT_ID + ':' + api.CLIENT_SECRET).toString('base64'),
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

const createMeeting = (data) => {
  const { access_token } = data;
  const options = {
    method: 'POST',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: { ...data },
    json: true,
  };

  return request(options);
};

const removeMeeting = (data) => {
  const { meeting_id, access_token } = data;
  const options = {
    method: 'DELETE',
    url: `https://api.zoom.us/v2/meetings/${meeting_id}`,
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
  };

  return request(options);
};

module.exports = {
  requestAuth,
  createMeeting,
  removeMeeting,
};
