const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const User = require('../models/user')
const UserLog = require('../models/user_log')
const sgMail = require('@sendgrid/mail')
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

const signUp = async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        error: errors.array()
      })
    }

    const password = req.body.password
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex')
    const user = new User({
      ...req.body,
      salt: salt,
      hash: hash,
      updated_at: new Date(),
      created_at: new Date(),
    })

    user.save()
    .then(_res => {
      sgMail.setApiKey(config.SENDGRID_KEY);
      const msg = {
        to: _res.email,
        from: mail_contents.WELCOME_SIGNUP.MAIL,
        subject: mail_contents.WELCOME_SIGNUP.SUBJECT,
        text: mail_contents.WELCOME_SIGNUP.TEXT,
        html: mail_contents.WELCOME_SIGNUP.TEXT
      }

      sgMail.send(msg).then((_msg) => {
        if(_msg[0].statusCode >= 200 && _msg[0].statusCode < 400){ 
          myJSON = JSON.stringify(_res)
          const data = JSON.parse(myJSON);
          delete data.hash
          delete data.salt
          res.send({
              status: true,
              data
          })
        }else {
          res.status(404).send({
            status: false,
            error: _res[0].statusCode
          })
        }
      }).catch ((e) => {
        console.error(e)
        res.status(500).send({
          status: false,
          error: 'internal_server_error'
        })
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

  let _user = await User.findOne({ email: email })
  .exec();

  if(!_user) {
    _user = await User.findOne({ user_name: user_name })
    .exec();  
  }


  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'Invalid email or password!'
    })
  }


  // Check password
  const hash = crypto.pbkdf2Sync(password, _user.salt, 10000, 512, 'sha512').toString('hex');
  if (hash != _user.hash) {
    return res.status(401).json({
      status: false,
      error: 'Invalid email or password!'
    })
  }

  const user_log = new UserLog({
    user: _user.id,
    created_at: new Date(),
    updated_at: new Date()
  })

  await user_log.save()
  // TODO: Include only email for now
  const token = jwt.sign({id:_user.id}, config.JWT_SECRET, {expiresIn: '1d'})
  myJSON = JSON.stringify(_user)
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
}

const checkAuth = async (req, res, next) => {
    const token = req.get('Authorization')
    let decoded
    try {
      decoded = jwt.verify(token, config.JWT_SECRET)
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      console.info('Auth Success:', decoded, ip)
    } catch (err) {
      console.error(err)
      
      return res.status(401).send({
        status: false,
        error: err.message
      })
      // err
    }
  

    req.currentUser = await User.findOne({ _id: decoded.id})

    if (req.currentUser) {
      next()
    } else {
      console.error('Valid JWT but no user:', decoded)
      res.send({
        status: false,
        error: 'invalid_user'
      })
    }
  }

const getMe = async(req, res) =>{
  const _user = req.currentUser
  myJSON = JSON.stringify(_user)
  const user = JSON.parse(myJSON);
  delete user.hash
  delete user.salt
  res.send({
    status: true,
    data: user
  })
}

const editMe = async(req, res) =>{
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
      delete data.password
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
    return res.status(401).json({
      status: false,
      error: errors.array()
    })
  }

  const _user = req.currentUser

   // Check old password
   const old_hash = crypto.pbkdf2Sync(old_password, _user.salt, 10000, 512, 'sha512').toString('hex');
   if (old_hash != _user.hash) {
     return res.status(401).json({
       status: false,
       error: 'Invalid old password!'
     })
   }

  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(new_password, salt, 10000, 512, 'sha512').toString('hex')

  _user.salt = salt
  _user.hash = hash
  await _user.save()

  res.send({
    status: true
  })
}

const syncOutlookEmail = async (req, res) => {
 
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'https://outlook.office.com/calendars.readwrite'
  ];

  // Authorization uri definition
  const authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: urls.EMAIL_AUTHORIZE_URL,
    scope: scopes.join(' ')
  })

  if (!authorizationUri) {
    return res.status(401).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }
  res.send({
    status: true,
    data: authorizationUri
  })
}

const authorizedOutlookEmail = async(req, res) => {
  const user = req.currentUser
  const code = req.query.code
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'https://outlook.office.com/calendars.readwrite'
  ];
  
  oauth2.authCode.getToken({
    code: code,
    redirect_uri: urls.EMAIL_AUTHORIZE_URL,
    scope: scopes.join(' ')
  }, function(error, result){
    if (error) {
      return res.status(500).send({
        status: false,
        error: error
      })
    }
    else {
      const outlook_token = oauth2.accessToken.create(result)
      user.refresh_token = outlook_token.token.refresh_token
      
      let token_parts = outlook_token.token.id_token.split('.');
    
      // Token content is in the second part, in urlsafe base64
      let encoded_token = new Buffer(token_parts[1].replace('-', '+').replace('_', '/'), 'base64');
    
      let decoded_token = encoded_token.toString();
    
      let jwt = JSON.parse(decoded_token);
    
      // Email is in the preferred_username field
      user.connected_email = jwt.preferred_username
      user.connect_email_type = 'outlook'
      
      user.save()
      .then(_res => {
          res.send({
            status: true,
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

const syncCalendar = async(req, res) => {
  const user = req.currentUser
  
  if( user.connected_email == undefined){
    return res.status(401).json({
      status: false,
      error: 'Conneted email doesn`t exist'
    })
  }

  user.connect_calendar = true

  await user.save()
  return res.send({
    status: true
  })
}

module.exports = {
    signUp,
    login,
    getMe,
    editMe,
    resetPasswordByOld,
    syncOutlookEmail,
    authorizedOutlookEmail,
    syncCalendar,
    checkAuth
}

