const request = require('request-promise');

const CLIENT_ID = 'mQgAEHmITMuvlvr0HInkQ';
const CLIENT_SECRET = 'fLvXkKXaVX01h2niehMmYpC5tkibfTc2';
const ACCESS_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiI2MWU4ZWRlYi00M2U4LTQyZWItYmMwZC0yZTYzMTk0ODVkNGIifQ.eyJ2ZXIiOjcsImF1aWQiOiIyYWE1MjljODJhZjdhYzVkMjI3NjJkM2FkZTA2MDRiMSIsImNvZGUiOiI3cmptTzhoa0xiXzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6bVFnQUVIbUlUTXV2bHZyMEhJbmtRIiwiZ25vIjowLCJ0eXBlIjowLCJ0aWQiOjAsImF1ZCI6Imh0dHBzOi8vb2F1dGguem9vbS51cyIsInVpZCI6IjhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJuYmYiOjE2MTc2MDM2MDcsImV4cCI6MTYxNzYwNzIwNywiaWF0IjoxNjE3NjAzNjA3LCJhaWQiOiJzSkFtUUwyZlF5R1NycVlZRk02UURBIiwianRpIjoiYmQ4MWY3MWYtYzY4MC00ZWRhLWE5ZmMtMGE1Y2U4NjE3MjM1In0.i6WUjPgtsn6xVRdXmUX_JY6_Bjo3fmNfaQy1Xa7nRrjXYUeV5Ry52LAJjcxl604ez4nleVRbfVQsRe59Nol9Vg';
const REFRESH_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiJkNWZmYmEwZC1iMGI1LTQyNzQtODJlOS0wNmExMjBmOTlmODAifQ.eyJ2ZXIiOjcsImF1aWQiOiIyYWE1MjljODJhZjdhYzVkMjI3NjJkM2FkZTA2MDRiMSIsImNvZGUiOiI3cmptTzhoa0xiXzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6bVFnQUVIbUlUTXV2bHZyMEhJbmtRIiwiZ25vIjowLCJ0eXBlIjoxLCJ0aWQiOjAsImF1ZCI6Imh0dHBzOi8vb2F1dGguem9vbS51cyIsInVpZCI6IjhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJuYmYiOjE2MTc2MDM2MDcsImV4cCI6MjA5MDY0MzYwNywiaWF0IjoxNjE3NjAzNjA3LCJhaWQiOiJzSkFtUUwyZlF5R1NycVlZRk02UURBIiwianRpIjoiYjgyOWFhNWMtMDdiMi00OGQ1LTlhYzItMzU2YmRiNTYzZDYwIn0.yxBPkV1d7fBnWlCGi8IbP9RT39ZKbsVtCgBgQ2NEV_SZwxBjkjzbS_x8MK5I8zuBBUl6f3KD1SLttTDloqP2IA';

const requestAuth = () => {
  var options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    qs: {
      grant_type: 'authorization_code',
      // The code below is a sample authorization code. Replace it with your actual authorization code while making requests.
      code: '7rjmO8hkLb_8nGKq1IyRWCIda5_7Vmycw',
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
  const BODY = {
    topic: 'string',
    type: 'integer',
    start_time: 'string [date-time]',
    duration: 'integer',
    schedule_for: 'string',
    timezone: 'string',
    password: 'string',
    agenda: 'string',
    recurrence: {
      type: 'integer',
      repeat_interval: 'integer',
      weekly_days: 'string',
      monthly_day: 'integer',
      monthly_week: 'integer',
      monthly_week_day: 'integer',
      end_times: 'integer',
      end_date_time: 'string [date-time]',
    },
    settings: {
      host_video: 'boolean',
      participant_video: 'boolean',
      cn_meeting: 'boolean',
      in_meeting: 'boolean',
      join_before_host: 'boolean',
      mute_upon_entry: 'boolean',
      watermark: 'boolean',
      use_pmi: 'boolean',
      approval_type: 'integer',
      registration_type: 'integer',
      audio: 'string',
      auto_recording: 'string',
      enforce_login: 'boolean',
      enforce_login_domains: 'string',
      alternative_hosts: 'string',
      global_dial_in_countries: ['string'],
      registrants_email_notification: 'boolean',
    },
  };

  var options = {
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

const refreshToken = () => {
  var options = {
    method: 'POST',
    url: 'https://zoom.us/oauth/token',
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/json',
    },
    qs: {
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    },
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });
};

requestAuth();
// refreshToken();
// createMeeting();