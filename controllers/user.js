const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const User = require('../models/user')
const UserLog = require('../models/user_log')
const Appointment = require('../models/appointment')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const sgMail = require('@sendgrid/mail')
const {google} = require('googleapis')
const outlook = require('node-outlook')
const CronJob = require('cron').CronJob;
const moment = require('moment');

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
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const client = require('twilio')(accountSid, authToken)

let daily_report
let weekly_report

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

    const areaCode = req.body['cell_phone'].substring(1, 4)
  
    const data = await client
    .availablePhoneNumbers('US')
    .local.list({
      areaCode: areaCode,
    })

    const number = data[0];
    const twilio_proxy_number = await client.incomingPhoneNumbers.create({
        phoneNumber: number.phoneNumber,
        smsUrl:  urls.SMS_RECEIVE_URL
      })['phoneNumber']
   
    const user = new User({
      ...req.body,
      salt: salt,
      hash: hash,
      twilio_proxy_number: twilio_proxy_number,
      updated_at: new Date(),
      created_at: new Date(),
    })

    user.save()
    .then(_res => {
      sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
      const msg = {
        to: _res.email,
        from: mail_contents.WELCOME_SIGNUP.MAIL,
        templateId: config.SENDGRID.SENDGRID_WELCOME_TEMPLATE,
        dynamic_template_data: {
          user_name: _res.user_name,
        },
      };

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
  const token = jwt.sign({id:_user.id}, config.JWT_SECRET)
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

const syncOutlook = async (req, res) => {
 
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'https://outlook.office.com/calendars.readwrite'
  ];

  // Authorization uri definition
  const authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: urls.OUTLOOK_AUTHORIZE_URL,
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

const authorizeOutlook = async(req, res) => {
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
    redirect_uri: urls.OUTLOOK_AUTHORIZE_URL,
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
      user.outlook_refresh_token = outlook_token.token.refresh_token
      
      let token_parts = outlook_token.token.id_token.split('.');
    
      // Token content is in the second part, in urlsafe base64
      let encoded_token = new Buffer(token_parts[1].replace('-', '+').replace('_', '/'), 'base64');
    
      let decoded_token = encoded_token.toString();
    
      let jwt = JSON.parse(decoded_token);
    
      // Email is in the preferred_username field
      user.connected_email = jwt.preferred_username
      user.connected_email_type = 'outlook'
      
      user.save()
      .then(_res => {
          res.send({
            status: true,
            data: user.connected_email
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

const syncGmail = async(req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  );
  
  // generate a url that asks permissions for Blogger and Google Calendar scopes
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  
  const authorizationUri = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',
  
    // If you only need one scope you can pass it as a string
    scope: scopes
  });

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

const authorizeGmail = async(req, res) => {
  const user = req.currentUser
  const code = req.query.code
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  )
  
  const {tokens} = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  if(typeof tokens.refresh_token !== 'undefined'){
    user.google_refresh_token = JSON.stringify(tokens)
  }
  
  if (!tokens) {
    return res.status(401).json({
      status: false,
      error: 'Client doesn`t exist'
    })
  }

  let oauth2 = google.oauth2({
    auth: oauth2Client,
    version: 'v2'
  })

  oauth2.userinfo.v2.me.get(function(err, _res) {
    // Email is in the preferred_username field
    user.connected_email = _res.data.email
    user.connected_email_type = 'gmail'
    
    user.save()
    .then(_res => {
      res.send({
        status: true,
        data: user.connected_email
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

const syncCalendar = async(req, res) => {
  const user = req.currentUser
  
  if( user.connected_email == undefined){
    return res.status(401).json({
      status: false,
      error: 'Conneted email doesn`t exist'
    })
  }

  if(user.connected_email_type == 'outlook'){
    const _appointments = await Appointment.find({user: user.id, del: false})
    for( let i = 0; i < _appointments.length; i ++ ) {
        let attendees = [];
        if(typeof _appointments[i].guests !='undefined' ){
          for( let j = 0; j<_appointments[i].guests.length; j ++){
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
              "DateTime":  _appointments[i].due_start,
              "TimeZone":"UTC" + user.time_zone
            },
            "End": {
              "DateTime":  _appointments[i].due_end,
              "TimeZone":"UTC" + user.time_zone
            },
            "Attendees": attendees
        };

        let token = oauth2.accessToken.create({ refresh_token: user.outlook_refresh_token, expires_in: 0})
        let accessToken
        await new Promise((resolve, reject) => {
          token.refresh(function(error, result) {
            if (error) {
              reject(error.message)
            }
            else {
              resolve(result.token);
            }
          })
        }).then((token)=>{
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
          console.log('event', event.Id)
          _appointments[i].event_id = event.Id
          _appointments[i].save()
        })
      }

    user.connect_calendar = true
    await user.save()
  
    return res.send({
      status: true
    })
  }else{
    const oauth2Client = new google.auth.OAuth2(
      config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    )
    const token = JSON.parse(user.google_refresh_token)
    oauth2Client.setCredentials({refresh_token: token.refresh_token}) 
    addGoogleCalendar(oauth2Client, user, res)
  }
}

const addGoogleCalendar = async (auth, user, res) => {
  const calendar = google.calendar({version: 'v3', auth})
  const _appointments = await Appointment.find({user: user.id})
  for( let i = 0; i < _appointments.length; i ++ ) {
    let attendees = [];
    if(typeof _appointments[i].guests != "undefined"){
      for( let j = 0; j<_appointments[i].guests.length; j ++){
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
    }, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
      _appointments[i].event_id = event.data.id
      _appointments[i].save()
    })
  }
  user.connect_calendar = true
  await user.save()

  return res.send({
    status: true
  })
}

const disconCalendar = async(req, res) => {
  const user = req.currentUser
  
  if( user.connected_email == undefined){
    return res.status(401).json({
      status: false,
      error: 'Conneted email doesn`t exist'
    })
  }

  if( user.connected_email_type == 'outlook' ){
    const _appointments = await Appointment.find({user: user.id})
    for( let i = 0; i < _appointments.length; i ++ ) {
      let token = oauth2.accessToken.create({ refresh_token: user.outlook_refresh_token, expires_in: 0})
        let accessToken

        await new Promise((resolve, reject) => {
          token.refresh(function(error, result) {
            if (error) {
              reject(error.message)
            }
            else {
              resolve(result.token);
            }
          })
        }).then((token)=>{
          accessToken = token.access_token
        }).catch((error) => {
          console.log('error', error)
        })
        
        let deleteEventParameters = {
          token: accessToken,
          eventId: _appointments[i].event_id
        };
      
      outlook.calendar.deleteEvent(deleteEventParameters, function(error) {
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
  }else{
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
  const calendar = google.calendar({version: 'v3', auth})
  const _appointments = await Appointment.find({user: user.id})
  for( let i = 0; i < _appointments.length; i ++ ) {
    const params = {
      calendarId: 'primary',
      eventId: _appointments[i].event_id,
    };
    calendar.events.delete(params, function(err) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
    })
  }
  user.connect_calendar = false
  await user.save()

  return res.send({
    status: true
  })
}

const dailyReport = async(req, res) => {

  const user = req.currentUser

  user['daily_report'] = true;

  await user.save()

  daily_report = new CronJob({
    // Run at 21:00 Central time, only on friday
    cronTime: '00 21 * * 1-6',
    onTick: async function() {
      const { currentUser } = req
      sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
    
      const start = new Date();
      start.setHours(0,0,0,0);
  
      const end = new Date();
      end.setHours(20,59,59,999);
      const activity = await Activity.find({user :currentUser.id, created_at: {$gte: start, $lt: end}})

      let now = moment();
      const today = now.format("dddd, MMMM Do YYYY")
      
      let contacts = []
      for (let i =0; i < activity.length; i ++){
        const contact = await Contact.findOne({_id: activity[i].contacts})
        let content = "<div class='content' style='display:flex; padding-top:20px; margin-right:10px;max-width: 500px;justify-content:space-around;padding-left:30px; border-bottom: 1px solid #afaaaa;'><div class='avatar' style='margin-right:20px;'><img style='margin:auto;' src='" + urls.AVATAR_URL+"' width='60px' height='60px' /></div>" + 
        "<div class='contact'><h3>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
        "<p style='margin: 0px'>" + activity[i].content +"</p></div>" + 
        "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.CONTACT_PAGE_URL + contact.id + "'>View Contact</a></button></div>"
        contacts.push(content)
      }
    
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$lt: current_time}});
      let overdue = [];
      
      for(let i = 0; i < _follow_up.length; i ++){
        const contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        const _overdue = "<div class='content' style='display:flex; padding-top:20px; margin-right:10px;max-width: 500px;justify-content:space-around;padding-left:30px; border-bottom: 1px solid #afaaaa;'><div class='avatar' style='margin-right:20px;'><img style='margin:auto;' src='" + urls.AVATAR_URL+"' width='60px' height='60px' /></div>" + 
        "<div class='contact'><h3>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
        "<p style='margin: 0px'>" + _follow_up[i].content +"</p></div>" + 
        "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.FOLLOWUP_PAGE_URL + contact.id + "'>View FollowUp</a></button></div>"
        overdue.push(_overdue)
      }
    
      const msg = {
        to: currentUser.email,
        from: mail_contents.DAILY_REPORT.MAIL,
        subject: mail_contents.DAILY_REPORT.SUBJECT,
        templateId: config.SENDGRID.SENDGRID_DAILY_REPORT_TEMPLATE,
        dynamic_template_data: {
          contacts: contacts,
          overdue: overdue,
          day: today
        },
      }
      await sgMail.send(msg)
    },
    start: true,
    timeZone: 'US/Central'
  });
  
  return res.send({
    status: true
  })
}

const weeklyReport = async(req, res) => {

  const user = req.currentUser

  user['weekly_report'] = true;

  await user.save()

  weekly_report = new CronJob({
    // Run at 21:00 Central time, only on friday
    cronTime: '00 21 * * Sun',
    onTick: async function() {
      const { currentUser } = req
      sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
    
      today = new Date();
      let day = today.getDay(),
          diff = today.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
      const monday = new Date(today.setDate(diff));
      monday.setHours(0,0,0,0);

      const end = new Date();
      end.setHours(20,59,59,999);
      const activity = await Activity.find({user :currentUser.id, created_at: {$gte: monday, $lt: end}}).sort({_id : -1 }).limit(15)
      let now = moment();
      const today = now.format("dddd, MMMM Do YYYY")
      
      let contacts = []
      for (let i =0; i < activity.length; i ++){
        const contact = await Contact.findOne({_id: activity[i].contacts})
        let content = "<div class='content' style='display:flex; padding-top:20px; margin-right:10px;max-width: 500px;justify-content:space-around;padding-left:30px; border-bottom: 1px solid #afaaaa;'><div class='avatar' style='margin-right:20px;'><img style='margin:auto;' src='" + urls.AVATAR_URL+"' width='60px' height='60px' /></div>" + 
        "<div class='contact'><h3>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
        "<p style='margin: 0px'>" + activity[i].content +"</p></div>" + 
        "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.CONTACT_PAGE_URL + contact.id + "'>View</a></button></div>"
        contacts.push(content)
      }
    
      const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$lt: current_time}});
      let overdue = [];
      
      for(let i = 0; i < _follow_up.length; i ++){
        const contact = await Contact.findOne({_id: _follow_up[i].contact}) 
        const _overdue = "<div class='content' style='display:flex; padding-top:20px; margin-right:10px;max-width: 500px;justify-content:space-around;padding-left:30px; border-bottom: 1px solid #afaaaa;'><div class='avatar' style='margin-right:20px;'><img style='margin:auto;' src='" + urls.AVATAR_URL+"' width='60px' height='60px' /></div>" + 
        "<div class='contact'><h3>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
        "<p style='margin: 0px'>" + _follow_up[i].content +"</p></div>" + 
        "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.FOLLOWUP_PAGE_URL + contact.id + "'>View FollowUp</a></button></div>"
        overdue.push(_overdue)
      }

      const msg = {
        to: currentUser.email,
        from: mail_contents.DAILY_REPORT.MAIL,
        subject: mail_contents.DAILY_REPORT.SUBJECT,
        templateId: config.SENDGRID.SENDGRID_DAILY_REPORT_TEMPLATE,
        dynamic_template_data: {
          contacts: contacts,
          overdue: overdue,
          day: today
        },
      }
      await sgMail.send(msg)
    },
    start: true,
    timeZone: 'US/Central'
  });
  
  console.log('weekly_report', weekly_report)
  
  return res.send({
    status: true,
    data: weekly_report
  })
}

const disconDaily = async(req, res) =>{
  const user = req.currentUser

  user['daily_report'] = false;

  await user.save()

  daily_report.stop()
  
  return res.send({
    status: true
  })
}

const disconWeekly = async(req, res) =>{
  const user = req.currentUser

  user['weekly_report'] = false;

  await user.save()

  weekly_report.stop()
  
  return res.send({
    status: true
  })
}

const desktopNotification = async(req, res) =>{
  const user = req.currentUser
  user['desktop_notification'] = true
  console.log('subscription', req.body['subscription'])
  user['desktop_notification_subscription'] = JSON.stringify(req.body['subscription'])

  await user.save()
  return res.send({
    status: true
  })
}

const disconDesktop = async(req, res) =>{
  const user = req.currentUser
  user['desktop_notification'] = false
  
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
    syncOutlook,
    authorizeOutlook,
    syncGmail,
    authorizeGmail,
    syncCalendar,
    disconCalendar,
    dailyReport,
    desktopNotification,
    disconDaily,
    disconWeekly,
    disconDesktop,
    weeklyReport,
    checkAuth
}

