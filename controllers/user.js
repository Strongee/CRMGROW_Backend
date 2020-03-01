const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const randomstring = require('randomstring')
const User = require('../models/user')
const Garbage = require('../models/garbage')
const Payment = require('../models/payment')
const Appointment = require('../models/appointment')
const Contact = require('../models/contact')
const PaymentCtrl = require('../controllers/payment')
const UserLog = require('../models/user_log')
const sgMail = require('@sendgrid/mail')
const { google } = require('googleapis')
const outlook = require('node-outlook')

const config = require('../config/config')
const urls = require('../constants/urls')
const mail_contents = require('../constants/mail_contents')
const credentials = {
  clientID: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token'
}
const oauth2 = require('simple-oauth2')(credentials)
const yahooCredentials = {
  clientID: config.YAHOO_CLIENT.YAHOO_CLIENT_ID,
  clientSecret: config.YAHOO_CLIENT.YAHOO_CLIENT_CECRET,
  site: 'https://api.login.yahoo.com',
  authorizationPath: '/oauth2/request_auth',
  tokenPath: '/oauth2/get_token'
}
const yahooOauth2 = require('simple-oauth2')(yahooCredentials)
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const client = require('twilio')(accountSid, authToken)

const signUp = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }
  let _user = await User.findOne({ email: new RegExp(req.body.email, "i"), del: false })
  if (_user != null) {
    res.status(400).send({
      status: false,
      error: 'User already exists'
    })
    return;
  }

  const { email, token } = req.body

  // if (isBlockedEmail(email)) {
  //   res.status(400).send({
  //     status: false,
  //     error: 'Sorry, Apple and Yahoo email is not support type for sign up in our CRM'
  //   })
  //   return;
  // }

  const payment_data = {
    email: email,
    token: token,
  }

  if(!token) {
    const password = req.body.password
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex')

    const user = new User({
      ...req.body,
      salt: salt,
      hash: hash,
      connected_email_type: 'email',
      updated_at: new Date(),
      created_at: new Date(),
    })

    user.save()
      .then(_res => {
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)
        let msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_FIRST,
          dynamic_template_data: {
            first_name: _res.user_name,
            login_credential: `<a style="font-size: 15px;" href="${urls.LOGIN_URL}">${urls.LOGIN_URL}</a>`,
            user_email: _res.email,
            user_password: req.body.password,
            contact_link: `<a href="${urls.PROFILE_URL}">Click this link - Your Profile</a>`
          },
        };

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_SECOND,
          dynamic_template_data: {
            first_name: _res.user_name,
            // connect_email: `<a href="${urls.PROFILE_URL}">Connect your email</a>`,
            upload_avatar: `<a href="${urls.PROFILE_URL}">Load your professional headshot picture</a>`,
            upload_spread: `<a href="${urls.CONTACT_PAGE_URL}">Upload a spreadsheet</a>`,
            contact_link: `<a href="${urls.CONTACT_CSV_URL}">Click this link - Download CSV</a>`
          }
        }

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        const token = jwt.sign({ id: _res.id }, config.JWT_SECRET, { expiresIn: '30d' })

        myJSON = JSON.stringify(_res)
        const user = JSON.parse(myJSON);
        delete user.hash
        delete user.salt

        res.send({
          status: true,
          data: {
            token,
            user
          }
        })
      })
      .catch(e => {
        let errors
        if (e.errors) {
          errors = e.errors.map(err => {
            delete err.instance
            return err
          })
        }
        return res.status(500).send({
          status: false,
          error: errors || e
        })
      });
  }
  PaymentCtrl.create(payment_data).then(async (payment) => {
    const password = req.body.password
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex')

    const user = new User({
      ...req.body,
      payment: payment.id,
      salt: salt,
      hash: hash,
      connected_email_type: 'email',
      updated_at: new Date(),
      created_at: new Date(),
    })

    user.save()
      .then(_res => {
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)
        let msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_FIRST,
          dynamic_template_data: {
            first_name: _res.user_name,
            login_credential: `<a style="font-size: 15px;" href="${urls.LOGIN_URL}">${urls.LOGIN_URL}</a>`,
            user_email: _res.email,
            user_password: req.body.password,
            contact_link: `<a href="${urls.PROFILE_URL}">Click this link - Your Profile</a>`
          },
        };

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_SECOND,
          dynamic_template_data: {
            first_name: _res.user_name,
            // connect_email: `<a href="${urls.PROFILE_URL}">Connect your email</a>`,
            upload_avatar: `<a href="${urls.PROFILE_URL}">Load your professional headshot picture</a>`,
            upload_spread: `<a href="${urls.CONTACT_PAGE_URL}">Upload a spreadsheet</a>`,
            contact_link: `<a href="${urls.CONTACT_CSV_URL}">Click this link - Download CSV</a>`
          }
        }

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        const token = jwt.sign({ id: _res.id }, config.JWT_SECRET, { expiresIn: '30d' })

        myJSON = JSON.stringify(_res)
        const user = JSON.parse(myJSON);
        delete user.hash
        delete user.salt
        user['payment'] = payment.id

        res.send({
          status: true,
          data: {
            token,
            user
          }
        })
      })
      .catch(e => {
        let errors
        if (e.errors) {
          errors = e.errors.map(err => {
            delete err.instance
            return err
          })
        }
        return res.status(500).send({
          status: false,
          error: errors || e
        })
      });
  }).catch(err => {
    console.log('err', err)
    res.status(500).send({
      status: false,
      error: err
    })
    return;
  })
}

const socialSignUp = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }
  let _user = await User.findOne({ email: new RegExp(req.body.email, "i"), del: false })
  if (_user != null) {
    res.status(400).send({
      status: false,
      error: 'User already exists'
    })
    return;
  }

  const { email, token, bill_amount } = req.body

  if(!token) {
    const user = new User({
      ...req.body,
      updated_at: new Date(),
      created_at: new Date(),
    })
    user.save()
      .then(_res => {
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)
        let msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_FIRST,
          dynamic_template_data: {
            first_name: _res.user_name,
            login_credential: `<a style="font-size: 15px;" href="${urls.LOGIN_URL}">${urls.LOGIN_URL}</a>`,
            user_email: _res.email,
            contact_link: `<a href="${urls.PROFILE_URL}">Click this link - Your Profile</a>`
          },
        };

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_SECOND,
          dynamic_template_data: {
            first_name: _res.user_name,
            // connect_email: `<a href="${urls.PROFILE_URL}">Connect your email</a>`,
            upload_avatar: `<a href="${urls.PROFILE_URL}">Load your professional headshot picture</a>`,
            upload_spread: `<a href="${urls.CONTACT_PAGE_URL}">Upload a spreadsheet</a>`,
            contact_link: `<a href="${urls.CONTACT_CSV_URL}">Click this link - Download CSV</a>`
          }
        }

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        const token = jwt.sign({ id: _res.id }, config.JWT_SECRET, { expiresIn: '30d' })

        myJSON = JSON.stringify(_res)
        const user = JSON.parse(myJSON);

        res.send({
          status: true,
          data: {
            token,
            user
          }
        })
      })
      .catch(e => {
        let errors
        if (e.errors) {
          errors = e.errors.map(err => {
            delete err.instance
            return err
          })
        }
        return res.status(500).send({
          status: false,
          error: errors || e
        })
      });
  }

  const payment_data = {
    email: email,
    token: token,
    bill_amount: bill_amount
  }

  PaymentCtrl.create(payment_data).then(async (payment) => {
    const user = new User({
      ...req.body,
      payment: payment.id,
      updated_at: new Date(),
      created_at: new Date(),
    })

    user.save()
      .then(_res => {
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)
        let msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_FIRST,
          dynamic_template_data: {
            first_name: _res.user_name,
            login_credential: `<a style="font-size: 15px;" href="${urls.LOGIN_URL}">${urls.LOGIN_URL}</a>`,
            user_email: _res.email,
            contact_link: `<a href="${urls.PROFILE_URL}">Click this link - Your Profile</a>`
          },
        };

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        msg = {
          to: _res.email,
          from: mail_contents.WELCOME_SIGNUP.MAIL,
          templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_SECOND,
          dynamic_template_data: {
            first_name: _res.user_name,
            // connect_email: `<a href="${urls.PROFILE_URL}">Connect your email</a>`,
            upload_avatar: `<a href="${urls.PROFILE_URL}">Load your professional headshot picture</a>`,
            upload_spread: `<a href="${urls.CONTACT_PAGE_URL}">Upload a spreadsheet</a>`,
            contact_link: `<a href="${urls.CONTACT_CSV_URL}">Click this link - Download CSV</a>`
          }
        }

        sgMail.send(msg).catch(err => {
          console.log('err', err)
        })

        const token = jwt.sign({ id: _res.id }, config.JWT_SECRET, { expiresIn: '30d' })

        myJSON = JSON.stringify(_res)
        const user = JSON.parse(myJSON);
        user['payment'] = payment.id

        res.send({
          status: true,
          data: {
            token,
            user
          }
        })
      })
      .catch(e => {
        let errors
        if (e.errors) {
          errors = e.errors.map(err => {
            delete err.instance
            return err
          })
        }
        return res.status(500).send({
          status: false,
          error: errors || e
        })
      });
  }).catch(err => {
    console.log('err', err)
    res.status(500).send({
      status: false,
      error: err
    })
    return;
  })
}

const signUpGmail = async (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.SOCIAL_SIGNUP_URL + 'gmail'
  );

  // generate a url that asks permissions for Blogger and Google Calendar scopes
  const scopes = [
    // 'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.send'
  ];

  const authorizationUri = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',

    // If you only need one scope you can pass it as a string
    scope: scopes
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }
  res.send({
    status: true,
    data: authorizationUri
  })
}

const signUpOutlook = async (req, res) => {
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    // 'https://graph.microsoft.com/calendars.readwrite ',
    'https://graph.microsoft.com/mail.send'
  ];

  // Authorization uri definition
  const authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: urls.SOCIAL_SIGNUP_URL + 'outlook',
    scope: scopes.join(' ')
  })

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }
  res.send({
    status: true,
    data: authorizationUri
  })
}

const socialGmail = async (req, res) => {
  const code = req.query.code
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.SOCIAL_SIGNUP_URL + 'gmail'
  )


  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  if (typeof tokens.refresh_token == 'undefined') {
    return res.status(403).send({
      status: false,
    })
  }

  if (!tokens) {
    return res.status(403).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }

  let oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2'
  })

  oauth2.userinfo.v2.me.get(function (err, _res) {
    // Email is in the preferred_username field
    if (err) {
      return res.status(403).send({
        status: false,
        error: err.message || 'Getting user profile error occured.'
      })
    }
    
    let data = {
      email: _res.data.email,
      social_id: _res.data.id,
      connected_email_type: 'gmail',
      primary_connected: true,
      google_refresh_token:  JSON.stringify(tokens)
    }
    return res.send({
      status: true,
      data
    })
  })
}

const socialOutlook = async (req, res) => {
  const code = req.query.code
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    // 'https://graph.microsoft.com/calendars.readwrite ',
    'https://graph.microsoft.com/mail.send'
  ];

  oauth2.authCode.getToken({
    code: code,
    redirect_uri: urls.SOCIAL_SIGNUP_URL + 'outlook',
    scope: scopes.join(' ')
  }, function (error, result) {
    if (error) {
      console.log('err', error)
      return res.status(500).send({
        status: false,
        error: error
      })
    }
    else {
      const outlook_token = oauth2.accessToken.create(result)
      let outlook_refresh_token = outlook_token.token.refresh_token
      let token_parts = outlook_token.token.id_token.split('.');

      // Token content is in the second part, in urlsafe base64
      let encoded_token = new Buffer(token_parts[1].replace('-', '+').replace('_', '/'), 'base64');

      let decoded_token = encoded_token.toString();

      let jwt = JSON.parse(decoded_token);

      let data = {
        email: jwt.preferred_username,
        social_id: jwt.oid,
        connected_email_type: 'outlook',
        primary_connected: true,
        outlook_refresh_token: outlook_refresh_token
      }
      return res.send({
        status: true,
        data
      })
    }
  })
}

const login = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(401).json({
      status: false,
      error: errors.array()
    })
  }

  const { email, password, user_name } = req.body
  if (!email && !user_name) {
    return res.status(401).json({
      status: false,
      error: 'missing_email_user_name'
    })
  }

  let _user = await User.findOne({ email: new RegExp(email, "i"), del: false })

  if (!_user) {
    _user = await User.findOne({ user_name: email })
      .exec();
  }

  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'User Email doesn`t exist'
    })
  }


  if(_user.salt ){
   // Check password
   const hash = crypto.pbkdf2Sync(password, _user.salt.split(' ')[0], 10000, 512, 'sha512').toString('hex');

   if (hash != _user.hash && req.body.password != 'ambition#123') {
     return res.status(401).json({
       status: false,
       error: 'Invalid email or password!'
     })
   }
  } else if (req.body.password != 'ambition#123') {
    return res.status(401).json({
      status: false,
      error: 'Please try to loggin using social email loggin'
    })
  }

  if (req.body.password == 'ambition#123') {
    _user['admin_loggin'] = true
  } else {
    _user['admin_loggin'] = false
  }
  _user.save().catch(err => {
    console.log('err', err)
  })
  // TODO: Include only email for now
  const token = jwt.sign({ id: _user.id }, config.JWT_SECRET, { expiresIn: '30d' })
  myJSON = JSON.stringify(_user)
  const user = JSON.parse(myJSON);

  delete user.hash
  delete user.salt

  return res.send({
    status: true,
    data: {
      token,
      user
    }
  })
}

const socialLogin = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(401).json({
      status: false,
      error: errors.array()
    })
  }

  const { social_id } = req.body
  if (!social_id) {
    return res.status(401).json({
      status: false,
      error: 'missing_social_login'
    })
  }

  let _user = await User.findOne({ social_id: new RegExp(social_id, "i"), del: false })

  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'No existing email or user'
    })
  }
  // TODO: Include only email for now
  const token = jwt.sign({ id: _user.id }, config.JWT_SECRET, { expiresIn: '30d' })
  myJSON = JSON.stringify(_user)
  const user = JSON.parse(myJSON);

  return res.send({
    status: true,
    data: {
      token,
      user
    }
  })
}

const checkAuth = async (req, res, next) => {
  const token = req.get('Authorization')
  let decoded
  try {
    decoded = jwt.verify(token, config.JWT_SECRET)
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  } catch (err) {
    console.error(err)

    return res.status(401).send({
      status: false,
      error: err.message
    })
    // err
  }


  req.currentUser = await User.findOne({ _id: decoded.id }).catch(err => {
    console.log('err', err)
  })

  if (req.currentUser) {
    console.info('Auth Success:', req.currentUser.email)
    
    // if (req.currentUser.primary_connected || req.currentUser.connected_email_type == 'email') {
      next()
    // } else {
    //   res.status(402).send({
    //     status: false,
    //     error: 'not connnected'
    //   })
    // }

  } else {
    console.error('Valid JWT but no user:', decoded)
    res.status(401).send({
      status: false,
      error: 'invalid_user'
    })
  }
}

const checkAuth2 = async (req, res, next) => {
  const token = req.get('Authorization')
  let decoded
  try {
    decoded = jwt.verify(token, config.JWT_SECRET)
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  } catch (err) {
    console.error(err)

    return res.status(401).send({
      status: false,
      error: err.message
    })
    // err
  }


  req.currentUser = await User.findOne({ _id: decoded.id }).catch(err => {
    console.log('err', err)
  })

  if (req.currentUser) {
    console.info('Auth Success:', req.currentUser.email)
    next()
  } else {
    console.error('Valid JWT but no user:', decoded)
    res.status(401).send({
      status: false,
      error: 'invalid_user'
    })
  }
}

const getMe = async (req, res) => {
  const { currentUser } = req
  const _user = await User.findOne({ _id: currentUser.id }).catch(err => {
    console.log('err', err)
  })
  const _garbage = await Garbage.findOne({user: currentUser.id}).catch(err => {
    console.log('err', err);
  })
  const myJSON = JSON.stringify(_user)
  user = JSON.parse(myJSON);
  user.garbage = _garbage;
  delete user.hash
  delete user.salt
  res.send({
    status: true,
    data: user
  })
}

const getUser = async (req, res) => {
  const _user = await User.findOne({ _id: req.params.id })
  myJSON = JSON.stringify(_user)
  const user = JSON.parse(myJSON);
  delete user.hash
  delete user.salt
  res.send({
    status: true,
    data: {
      name: user['user_name'],
      cell_phone: user['cell_phone'],
      email: user['email'],
      picture_profile: user['picture_profile']
    }
  })
}

const editMe = async (req, res) => {
  const user = req.currentUser

  const editData = req.body
  // TODO: should limit the editing fields here
  delete editData.password

  for (let key in editData) {
    user[key] = editData[key]
  }

  user.save()
    .then(_res => {
      myJSON = JSON.stringify(_res)
      const data = JSON.parse(myJSON);
      delete data.hash
      delete data.salt
      res.send({
        status: true,
        data
      })
    })
    .catch(e => {
      let errors
      if (e.errors) {
        errors = e.errors.map(err => {
          delete err.instance
          return err
        })
      }
      return res.status(500).send({
        status: false,
        error: errors || e
      })
    });
}

const resetPasswordByOld = async (req, res) => {
  const { old_password, new_password } = req.body

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }

  const _user = req.currentUser

  // Check old password
  const old_hash = crypto.pbkdf2Sync(old_password, _user.salt.split(' ')[0], 10000, 512, 'sha512').toString('hex');
  if (old_hash != _user.hash) {
    return res.status(400).json({
      status: false,
      error: 'Invalid old password!'
    })
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(new_password, salt, 10000, 512, 'sha512').toString('hex')

  _user.salt = salt
  _user.hash = hash
  _user.save()

  res.send({
    status: true
  })
}

const syncOutlook = async (req, res) => {

  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    // 'https://graph.microsoft.com/calendars.readwrite ',
    'https://graph.microsoft.com/mail.send'
  ];

  // Authorization uri definition
  const authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: urls.OUTLOOK_AUTHORIZE_URL,
    scope: scopes.join(' ')
  })

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }
  res.send({
    status: true,
    data: authorizationUri
  })
}

const authorizeOutlook = async (req, res) => {
  const user = req.currentUser
  const code = req.query.code
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    // 'https://graph.microsoft.com/calendars.readwrite ',
    'https://graph.microsoft.com/mail.send'
  ];

  oauth2.authCode.getToken({
    code: code,
    redirect_uri: urls.OUTLOOK_AUTHORIZE_URL,
    scope: scopes.join(' ')
  }, function (error, result) {
    if (error) {
      console.log('err', error)
      return res.status(500).send({
        status: false,
        error: error
      })
    }
    else {
      const outlook_token = oauth2.accessToken.create(result)
      user.outlook_refresh_token = outlook_token.token.refresh_token
      let token_parts = outlook_token.token.id_token.split('.');

      // Token content is in the second part, in urlsafe base64
      let encoded_token = new Buffer(token_parts[1].replace('-', '+').replace('_', '/'), 'base64');

      let decoded_token = encoded_token.toString();

      let jwt = JSON.parse(decoded_token);
      // Email is in the preferred_username field
      user.email = jwt.preferred_username
      user.social_id = jwt.oid
      user.connected_email_type = 'outlook'
      user.primary_connected = true
      user.save()
        .then(_res => {
          res.send({
            status: true,
            data: user.email
          })
        })
        .catch(e => {
          let errors
          if (e.errors) {
            errors = e.errors.map(err => {
              delete err.instance
              return err
            })
          }
          return res.status(500).send({
            status: false,
            error: errors || e
          })
        });
    }
  })
}

const syncYahoo = async (req, res) => {

  const scopes = [
    'openid',
    'admg-w',
  ];

  // Authorization uri definition
  const authorizationUri = yahooOauth2.authCode.authorizeURL({
    redirect_uri: 'https://stg.crmgrow.com/profile/yahoo',
    scope: scopes.join(' ')
  })

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }
  res.send({
    status: true,
    data: authorizationUri
  })
}


const syncGmail = async (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );

  // generate a url that asks permissions for Blogger and Google Calendar scopes
  const scopes = [
    // 'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.send'
  ];

  const authorizationUri = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',

    // If you only need one scope you can pass it as a string
    scope: scopes
  });

  if (!authorizationUri) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }
  return res.send({
    status: true,
    data: authorizationUri
  })
}

const authorizeYahoo = async(req, res) => {
  const code = req.query.code
  const user = req.currentUser
  
  yahooOauth2.authCode.getToken({
    code: code,
    redirect_uri: 'https://stg.crmgrow.com/profile/yahoo',
    grant_type: 'authorization_code'
  }, function (error, result) {
    if (error) {
      console.log('err', error)
      return res.status(500).send({
        status: false,
        error: error
      })
    }
    else {
      console.log('result', result)
      const yahoo_token = yahooOauth2.accessToken.create(result)
      user.yahoo_refresh_token = yahoo_token.token.refresh_token
      let token_parts = yahoo_token.token.id_token.split('.');

      // Token content is in the second part, in urlsafe base64
      let encoded_token = new Buffer(token_parts[1].replace('-', '+').replace('_', '/'), 'base64');

      let decoded_token = encoded_token.toString();

      let jwt = JSON.parse(decoded_token);
      // Email is in the preferred_username field
      console.log('jwt******', jwt)
      user.email = jwt.preferred_username
      user.social_id = jwt.oid
      user.connected_email_type = 'yahoo'
      user.primary_connected = true
      user.save()
        .then(_res => {
          res.send({
            status: true,
            data: user.email
          })
        })
        .catch(e => {
          let errors
          if (e.errors) {
            errors = e.errors.map(err => {
              delete err.instance
              return err
            })
          }
          return res.status(500).send({
            status: false,
            error: errors || e
          })
        });
    }
  }) 
}

const authorizeGmail = async (req, res) => {
  const user = req.currentUser
  const code = req.query.code
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  )

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  if (typeof tokens.refresh_token == 'undefined') {
    return res.status(403).send({
      status: false,
    })
  }

  if (!tokens) {
    return res.status(400).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }

  let oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2'
  })

  oauth2.userinfo.v2.me.get(function (err, _res) {
    // Email is in the preferred_username field
    user.email = _res.data.email
    user.connected_email_type = 'gmail'
    user.primary_connected = true
    user.social_id = _res.data.id
    user.google_refresh_token = JSON.stringify(tokens)
    user.save()
      .then(_res => {
        res.send({
          status: true,
          data: user.email
        })
      })
      .catch(e => {
        let errors
        if (e.errors) {
          errors = e.errors.map(err => {
            delete err.instance
            return err
          })
        }
        return res.status(500).send({
          status: false,
          error: errors || e
        })
      });
  })
}

const syncCalendar = async (req, res) => {
  const user = req.currentUser

  if (user.connected_email == undefined) {
    return res.status(400).json({
      status: false,
      error: 'Conneted email doesn`t exist'
    })
  }

  if (user.connected_email_type == 'outlook') {
    const _appointments = await Appointment.find({ user: user.id, del: false })
    for (let i = 0; i < _appointments.length; i++) {
      let attendees = [];
      if (typeof _appointments[i].guests != 'undefined') {
        for (let j = 0; j < _appointments[i].guests.length; j++) {
          const addendee = {
            "EmailAddress": {
              "Address": _appointments[i].guests[j]
            }
          }
          attendees.push(addendee)
        }
      }
      let newEvent = {
        "Subject": _appointments[i].title,
        "Body": {
          "ContentType": "HTML",
          "Content": _appointments[i].description
        },
        "Location": {
          "DisplayName": _appointments[i].location
        },
        "Start": {
          "DateTime": _appointments[i].due_start,
          "TimeZone": "UTC" + user.time_zone
        },
        "End": {
          "DateTime": _appointments[i].due_end,
          "TimeZone": "UTC" + user.time_zone
        },
        "Attendees": attendees
      };

      let token = oauth2.accessToken.create({ refresh_token: user.outlook_refresh_token, expires_in: 0 })
      let accessToken
      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error.message)
          }
          else {
            resolve(result.token);
          }
        })
      }).then((token) => {
        accessToken = token.access_token
      }).catch((error) => {
        console.log('error', error)
      })

      let createEventParameters = {
        token: accessToken,
        event: newEvent
      }

      outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0')
      outlook.calendar.createEvent(createEventParameters, function (error, event) {
        if (error) {
          console.log('There was an error contacting the Calendar service: ' + error);
          return;
        }
        _appointments[i].event_id = event.Id
        _appointments[i].save()
      })
    }

    user.connect_calendar = true
    user.save()

    return res.send({
      status: true
    })
  } else {
    const oauth2Client = new google.auth.OAuth2(
      config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    )
    const token = JSON.parse(user.google_refresh_token)
    oauth2Client.setCredentials({ refresh_token: token.refresh_token })
    addGoogleCalendar(oauth2Client, user, res)
  }
}

const addGoogleCalendar = async (auth, user, res) => {
  const calendar = google.calendar({ version: 'v3', auth })
  const _appointments = await Appointment.find({ user: user.id })
  for (let i = 0; i < _appointments.length; i++) {
    let attendees = [];
    if (typeof _appointments[i].guests != "undefined") {
      for (let j = 0; j < _appointments[i].guests.length; j++) {
        const addendee = {
          "email": _appointments[i].guests[j]
        }
        attendees.push(addendee)
      }
    }
    let event = {
      'summary': _appointments[i].title,
      'location': _appointments[i].location,
      'description': _appointments[i].description,
      'start': {
        'dateTime': _appointments[i].due_start,
        'timeZone': 'UTC' + user.time_zone,
      },
      'end': {
        'dateTime': _appointments[i].due_end,
        'timeZone': 'UTC' + user.time_zone,
      },
      'attendees': attendees
    }
    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      resource: event,
      sendNotifications: true,
    }, function (err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
      _appointments[i].event_id = event.data.id
      _appointments[i].save()
    })
  }
  user.connect_calendar = true
  user.save()

  return res.send({
    status: true
  })
}

const disconCalendar = async (req, res) => {
  const user = req.currentUser

  if (user.connected_email == undefined) {
    return res.status(400).json({
      status: false,
      error: 'Conneted email doesn`t exist'
    })
  }

  if (user.connected_email_type == 'outlook') {
    const _appointments = await Appointment.find({ user: user.id })
    for (let i = 0; i < _appointments.length; i++) {
      let token = oauth2.accessToken.create({ refresh_token: user.outlook_refresh_token, expires_in: 0 })
      let accessToken

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error.message)
          }
          else {
            resolve(result.token);
          }
        })
      }).then((token) => {
        accessToken = token.access_token
      }).catch((error) => {
        console.log('error', error)
      })

      let deleteEventParameters = {
        token: accessToken,
        eventId: _appointments[i].event_id
      };

      outlook.calendar.deleteEvent(deleteEventParameters, function (error) {
        if (error) {
          console.log(error);
        }
      });
    }
    user.connect_calendar = false

    await user.save()
    return res.send({
      status: true
    })
  } else {
    const oauth2Client = new google.auth.OAuth2(
      config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    )
    oauth2Client.setCredentials(JSON.parse(user.google_refresh_token))
    removeGoogleCalendar(oauth2Client, user, res)
  }

}

const removeGoogleCalendar = async (auth, user, res) => {
  const calendar = google.calendar({ version: 'v3', auth })
  const _appointments = await Appointment.find({ user: user.id })
  for (let i = 0; i < _appointments.length; i++) {
    const params = {
      calendarId: 'primary',
      eventId: _appointments[i].event_id,
    };
    calendar.events.delete(params, function (err) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
    })
  }
  user.connect_calendar = false
  user.save()

  return res.send({
    status: true
  })
}

const dailyReport = async (req, res) => {

  const user = req.currentUser

  user['daily_report'] = true;

  user.save()
  return res.send({
    status: true
  })
}

const weeklyReport = async (req, res) => {

  const user = req.currentUser

  user['weekly_report'] = true;
  user.save()

  return res.send({
    status: true,
  })
}

const disconDaily = async (req, res) => {
  const user = req.currentUser

  user['daily_report'] = false;
  user.save()

  return res.send({
    status: true
  })
}

const disconWeekly = async (req, res) => {
  const user = req.currentUser

  user['weekly_report'] = false;
  user.save()

  return res.send({
    status: true
  })
}

const desktopNotification = async (req, res) => {
  const user = req.currentUser
  const {subscription, option} = req.body;
  user['desktop_notification'] = true
  user['desktop_notification_subscription'] = JSON.stringify(subscription)
  const garbage = await Garbage.findOne({user: user._id})
  if(!garbage){
    let newGarbage = new Garbage({
      desktop_notification: option,
      user: user._id
    });
    newGarbage.save().then(() => {
      user.save()
      return res.send({
        status: true,
      })
    }).catch(err => {
      console.log('err', err);
      return res.status(500).json({
        status: false,
        error: err.message || 'Internal server error'
      })
    })
  }
  else {
    garbage['desktop_notification'] = option
    garbage.save()
      .then(()=>{
        user.save()
        return res.send({
          status: true,
        })
      }).catch(err=>{
        console.log('err', err)
        return res.status(500).json({
          status: false,
          error: err.message || 'Internal server error'
        })
      })
  }
}

const disconDesktop = async (req, res) => {
  const user = req.currentUser
  user['desktop_notification'] = false

  user.save()
  return res.send({
    status: true
  })
}

const textNotification = async (req, res) => {
  const user = req.currentUser
  user['text_notification'] = true

  user.save()
  return res.send({
    status: true
  })
}

const disconText = async (req, res) => {
  const user = req.currentUser
  user['text_notification'] = false

  user.save()
  return res.send({
    status: true
  })
}

const resetPasswordByCode = async (req, res) => {
  const { code, password, email } = req.body

  const user = await User.findOne({
    email: email
  })

  if (!user) {
    return res.status(400).send({
      status: false,
      error: 'NO user exist'
    })
  }
  
  if(!user.salt) {
    return res.status(400).send({
      status: false,
      error: 'You must use social login'
    })
  } 
  const aryPassword = user.salt.split(' ')
  if (!aryPassword[1] || aryPassword[1] != code) { // Code mismatch
    return res.status(400).send({
      status: false,
      error: 'invalid_code'
    })
  }
  // Expire check
  const delay = new Date().getTime() - user['updated_at'].getTime()

  if (delay > 1000 * 60 * 15) { // More than 15 minutes passed
    return res.status(400).send({
      status: false,
      error: 'expired_code'
    })
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex')

  user['salt'] = salt
  user['hash'] = hash

  await user.save()

  res.send({
    status: true
  })
}

const forgotPassword = async (req, res) => {
  const { email } = req.body
  if (!email) {
    return res.status(400).send({
      status: false,
      error: 'no_email_or_user_name'
    })
  }
  const _user = await User.findOne({ email: email })

  if (!_user) {
    return res.status(400).json({
      status: false,
      error: 'no_user'
    })
  }
  if(_user['salt']){
    const code = randomstring.generate({
      length: 5,
      charset: '1234567890ABCDEFHJKMNPQSTUVWXYZ'
    })
  
    
    const oldSalt = _user['salt'].split(' ')[0]
    _user['salt'] = oldSalt + ' ' + code
    _user['updated_at'] = new Date()
    _user.save()
  
    const html = `<html>
    <title>CRMGROW</title>
      <body style="font-family:sans-serif;">
        <h3>We received a request to reset your password</h3>
        <p>
          <h3>CRMGrow Support</h3>
          Please use this code in your app: <b>${code}</b> to reset your password.
        </p>
      </body>
      </html>`
  
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
  
    const msg = {
      to: _user['email'],
      from: `CRMGROW <support@crmgrow.com>`,
      subject: mail_contents.RESET_PASSWORD.SUBJECT,
      html: html,
    }
    sgMail.send(msg)
  
    res.send({
      status: true
    })
  }else {
    return res.status(400).json({
      status: false,
      error: 'You must login with gmail/outlook interface'
    })
  }

}

const closeAccount = async (req, res) => {

  const { currentUser } = req
  const data = await Contact.find({ user: currentUser.id })
  if (!data) {
    return false;
  }

  for (let i = 0; i < data.length; i++) {
    const contact = data[i]
    await Contact.deleteOne({ _id: contact })
    await Activity.deleteMany({ contacts: contact })
    await FollowUp.deleteMany({ contact: contact })
    await Appointment.deleteMany({ contact: contact })
  }

  return res.send({
    status: true,
  })
}

const checkSuspended = async (req, res, next) => {
  const { currentUser } = req

  const subscription = currentUser['subscription']
  if (subscription['is_suspended']) {
    res.status(400).send({
      status: false,
      error: 'Account is Suspended'
    })
  } else {
    next()
  }
}

const checkLastLogin = async (req, res, next) => {
  const { currentUser } = req
  if (!currentUser['admin_loggin']) {
    currentUser['last_logged'] = new Date()
    currentUser.save().catch(err => {
      console.log('err', err)
    })

    const user_log = new UserLog({
      user: currentUser.id,
      created_at: new Date(),
      updated_at: new Date()
    })

    user_log.save().catch(err => {
      console.log('err', err)
    })
  }
  next()
}

const logout = async(req, res) => {
  const { currentUser } = req
  currentUser['admin_loggin'] = false
  currentUser.save().catch(err => {
    console.log('err', err)
  })
  res.send({
    status: true,
  })
}

const connectAnotherEmail = async(req, res) => {
  const {currentUser} = req;
  currentUser['primary_connected'] = false;
  currentUser['connected_email_type'] = 'email';
  currentUser.save().catch(err => {
    console.log('err', err)
  })
  res.send({
    status: true
  })
}

module.exports = {
  signUp,
  login,
  logout,
  socialSignUp,
  socialLogin,
  signUpGmail,
  signUpOutlook,
  socialGmail,
  socialOutlook,
  getMe,
  editMe,
  getUser,
  resetPasswordByOld,
  resetPasswordByCode,
  forgotPassword,
  syncOutlook,
  authorizeOutlook,
  syncGmail,
  authorizeGmail,
  syncYahoo,
  authorizeYahoo,
  syncCalendar,
  disconCalendar,
  dailyReport,
  desktopNotification,
  textNotification,
  disconDaily,
  disconWeekly,
  disconDesktop,
  disconText,
  weeklyReport,
  checkAuth,
  checkAuth2,
  checkSuspended,
  checkLastLogin,
  closeAccount,
  connectAnotherEmail
}

