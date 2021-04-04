const request = require('request-promise');

const CLIENT_ID = 'mQgAEHmITMuvlvr0HInkQ';
const CLIENT_SECRET = 'fLvXkKXaVX01h2niehMmYpC5tkibfTc2';
const ACCESS_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiIwNGI0MWJkNC0wYjhjLTRlMzEtOTQyOS0wYjI5Mzk0NjA1ZDcifQ.eyJ2ZXIiOjcsImF1aWQiOiIyYmUxOTRmMGE4MzRmYzdhZjFkOGYzOTQyMTgwMmYyMyIsImNvZGUiOiJrRzlndW1PeHJsXzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6bVFnQUVIbUlUTXV2bHZyMEhJbmtRIiwiZ25vIjowLCJ0eXBlIjowLCJ0aWQiOjAsImF1ZCI6Imh0dHBzOi8vb2F1dGguem9vbS51cyIsInVpZCI6IjhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJuYmYiOjE2MTc1NTg4NzYsImV4cCI6MTYxNzU2MjQ3NiwiaWF0IjoxNjE3NTU4ODc2LCJhaWQiOiJzSkFtUUwyZlF5R1NycVlZRk02UURBIiwianRpIjoiNDE1M2E1YWQtNTYwNi00ZDZkLWIxNjgtYzViNGY3ZGQ3ZjM4In0.SAQLMxy_n2piPYnbBuzXwl5gyISrKllJPu8T1TCtiMYcCdGD5cOWnSpBrx3AXEAcHEbR6fx0u8gVThFsHKCQvw';
const REFRESH_TOKEN =
  'eyJhbGciOiJIUzUxMiIsInYiOiIyLjAiLCJraWQiOiI1ZjFhOGJhMy00MzU3LTQ2NzAtYWRiNC0xZjJmNGRjODgzZTQifQ.eyJ2ZXIiOjcsImF1aWQiOiIyYmUxOTRmMGE4MzRmYzdhZjFkOGYzOTQyMTgwMmYyMyIsImNvZGUiOiJrRzlndW1PeHJsXzhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJpc3MiOiJ6bTpjaWQ6bVFnQUVIbUlUTXV2bHZyMEhJbmtRIiwiZ25vIjowLCJ0eXBlIjoxLCJ0aWQiOjAsImF1ZCI6Imh0dHBzOi8vb2F1dGguem9vbS51cyIsInVpZCI6IjhuR0txMUl5UldDSWRhNV83Vm15Y3ciLCJuYmYiOjE2MTc1NTg4NzYsImV4cCI6MjA5MDU5ODg3NiwiaWF0IjoxNjE3NTU4ODc2LCJhaWQiOiJzSkFtUUwyZlF5R1NycVlZRk02UURBIiwianRpIjoiODZlNDEwYWItZDdhZi00ZDgzLThlMjAtYTYzN2IwNGMwYTgzIn0.h6dltv5f4sg-QFnyAv47SjB6cIS2zqQp9SfpeIfQ9zDWIC58ILD2DNmqUeKaoF2LKYGlv4Jy9KaA5uWWh7R1PQ';

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
      schedule_for: 'super@crmgrow.com',
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
