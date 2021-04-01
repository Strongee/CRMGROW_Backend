const request = require('request-promise');

const CLIENT_ID = 'mQgAEHmITMuvlvr0HInkQ';
const CLIENT_SECRET = 'fLvXkKXaVX01h2niehMmYpC5tkibfTc2';
const ACCESS_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiJjNDU4MTYzZC05MjA2LTRhMTYtYmY3MC1lZjZkNjc1MzgyNTYifQ.eyJ2ZXIiOjcsImF1aWQiOiIyYmUxOTRmMGE4MzRmYzdhZjFkOGYzOTQyMTgwMmYyMyIsImNvZGUiOiJkcTVBYzR2cFo2XzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6bVFnQUVIbUlUTXV2bHZyMEhJbmtRIiwiZ25vIjowLCJ0eXBlIjowLCJ0aWQiOjAsImF1ZCI6Imh0dHBzOi8vb2F1dGguem9vbS51cyIsInVpZCI6IjhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJuYmYiOjE2MTcyNTkyNTksImV4cCI6MTYxNzI2Mjg1OSwiaWF0IjoxNjE3MjU5MjU5LCJhaWQiOiJzSkFtUUwyZlF5R1NycVlZRk02UURBIiwianRpIjoiMzVjNzQ4ZjAtMWQ4ZS00Njk0LWEwN2UtOWRmYzkyMGQxMWNjIn0.bikW0hJiDUnu7BybF1R6DtG9siHEAPuwUa3As9UMHHRBZxX7gjakdlwfRqooxE3r5GVokfJr6SA8PTo9gDop0A';
const REFRESH_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiI2ZWExOTk0Ni1kY2FjLTQzNzUtYWM1OS05MDc0MjE4YjczYjQifQ.eyJ2ZXIiOjcsImF1aWQiOiIyYmUxOTRmMGE4MzRmYzdhZjFkOGYzOTQyMTgwMmYyMyIsImNvZGUiOiJkcTVBYzR2cFo2XzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6bVFnQUVIbUlUTXV2bHZyMEhJbmtRIiwiZ25vIjowLCJ0eXBlIjoxLCJ0aWQiOjAsImF1ZCI6Imh0dHBzOi8vb2F1dGguem9vbS51cyIsInVpZCI6IjhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJuYmYiOjE2MTcyNTkyNTksImV4cCI6MjA5MDI5OTI1OSwiaWF0IjoxNjE3MjU5MjU5LCJhaWQiOiJzSkFtUUwyZlF5R1NycVlZRk02UURBIiwianRpIjoiMmZkOTBlZDktMjNmNS00Njk2LTg5MTgtMjgzNWI0YzkwYzk4In0.c96zfzBdSwN53CQZJdy8qDtKzC6KGNNtI8ro8dOxA2qHASSdZP8vVVOO69VWjm8QaCrFS5-bpa5_qNEK3CmJLQ';


const requestAuth = () => {
  var options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    qs: {
      grant_type: 'authorization_code',
      // The code below is a sample authorization code. Replace it with your actual authorization code while making requests.
      code: 'dq5Ac4vpZ6_8nGKq1IyRWCIda5_7Vmycw',
      // The uri below is a sample redirect_uri. Replace it with your actual redirect_uri while making requests.
      redirect_uri:
        'http://teamgrow-staticsite-green.s3-website-us-west-1.amazonaws.com/profile/zoom',
    },
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization:
        'Basic ' +
        Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

const createMeeting = () => {
  var options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    qs: {
      grant_type: 'authorization_code',
      // The code below is a sample authorization code. Replace it with your actual authorization code while making requests.
      code: 'dq5Ac4vpZ6_8nGKq1IyRWCIda5_7Vmycw',
      // The uri below is a sample redirect_uri. Replace it with your actual redirect_uri while making requests.
      redirect_uri:
        'http://teamgrow-staticsite-green.s3-website-us-west-1.amazonaws.com/profile/zoom',
    },
    headers: {
      /** The credential below is a sample base64 encoded credential. Replace it with "Authorization: 'Basic ' + Buffer.from(your_app_client_id + ':' + your_app_client_secret).toString('base64')"
       * */
      Authorization:
        'Basic ' +
        Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
}