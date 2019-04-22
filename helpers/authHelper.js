let clientId = 'cf34076b-4bb2-4eef-8fdb-a7d7f2376095';
let clientSecret = 'pzckCYYXIL27}-]snkJ059)';
let redirectUri = 'https://teamgrow/api/user/authorize';

let scopes = [
  'openid',
  'profile',
  'offline_access',
  'https://outlook.office.com/calendars.readwrite'
];

let credentials = {
  client: {
    id: clientId,
    secret: clientSecret
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: 'common/oauth2/v2.0/authorize',
    tokenPath: 'common/oauth2/v2.0/token'
  }
}
let oauth2 = require('simple-oauth2').create(credentials)

module.exports = {
  getAuthUrl: function() {
    let returnVal = oauth2.authorizationCode.authorizeURL({
      redirect_uri: redirectUri,
      scope: scopes.join(' ')
    });
    console.log('');
    console.log('Generated auth url: ' + returnVal);
    return returnVal;
  },

  getTokenFromCode: function(auth_code, callback, request, response) {
    oauth2.authCode.getToken({
      code: auth_code,
      redirect_uri: redirectUri,
      scope: scopes.join(' ')
      }, function (error, result) {
        if (error) {
          console.log('Access token error: ', error.message);
          callback(request ,response, error, null);
        }
        else {
          let token = oauth2.accessToken.create(result);
          console.log('');
          console.log('Token created: ', token.token);
          callback(request, response, null, token);
        }
      });
  },

  getEmailFromIdToken: function(id_token) {
    // JWT is in three parts, separated by a '.'
    let token_parts = id_token.split('.');

    // Token content is in the second part, in urlsafe base64
    let encoded_token = new Buffer(token_parts[1].replace('-', '+').replace('_', '/'), 'base64');

    let decoded_token = encoded_token.toString();

    let jwt = JSON.parse(decoded_token);

    // Email is in the preferred_username field
    return jwt.preferred_username
  },

  getTokenFromRefreshToken: function(refresh_token, callback, request, response) {
    let token = oauth2.accessToken.create({ refresh_token: refresh_token, expires_in: 0});
    token.refresh(function(error, result) {
      if (error) {
        console.log('Refresh token error: ', error.message);
        callback(request, response, error, null);
      }
      else {
        console.log('New token: ', result.token);
        callback(request, response, null, result);
      }
    });
  }
};
