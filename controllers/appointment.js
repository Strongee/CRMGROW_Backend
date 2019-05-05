const { validationResult } = require('express-validator/check')
const outlook = require('node-outlook')
const moment = require('moment')
const config = require('../config/config')
const urls = require('../constants/urls')
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');
const credentials = {
  clientID: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token'
}
const oauth2 = require('simple-oauth2')(credentials)
const {google} = require('googleapis')

const get = async(req, res) => {
  const { currentUser } = req
  let data = []

  if(currentUser.connect_calendar){
  
    if(currentUser.connected_email_type == 'outlook'){
      outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');

      outlook.base.setAnchorMailbox(currentUser.connected_email);
      // Set the preferred time zone
      //outlook.base.setPreferredTimeZone(currentUser.time_zone);
      
      // Calendar sync works on the CalendarView endpoint
      requestUrl = outlook.base.apiEndpoint() + '/Me/CalendarView';
    
      // Set up our sync window from midnight on the current day to
      // midnight 7 days from now.
      let startDate = moment().startOf('week');
      let endDate = moment(startDate).add(30, 'days');
      // The start and end date are passed as query parameters
      let params = {
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString()
      };
      
      // Set the required headers for sync
      let headers = {
        Prefer: [ 
          // Enables sync functionality
          'odata.track-changes',
        ]
      };
    
      let token = oauth2.accessToken.create({ refresh_token: currentUser.outlook_refresh_token, expires_in: 0})
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
    
      let apiOptions = {
        url: requestUrl,
        token: accessToken,
        headers: headers,
        query: params
      }
      
      outlook.base.makeApiCall(apiOptions, function(error, response) {
        if (error) {
          console.log(JSON.stringify(error))
          return res.status(401).json({
            status: false,
            error: error
          })
        } else {
            if (response.statusCode !== 200) {
              console.log('API Call returned ' + JSON.stringify(response))
              return res.status(500).send({
                status: false,
                error: response.statusCode
              })
            } else {
                const _outlook_calendar_data_list = response.body.value
                for(let i = 0; i< _outlook_calendar_data_list.length; i++){
                  let  _outlook_calendar_data = {}
                  _outlook_calendar_data.title = _outlook_calendar_data_list[i].Subject
                  _outlook_calendar_data.description = _outlook_calendar_data_list[i].Body.Content
                  _outlook_calendar_data.location = _outlook_calendar_data_list[i].Location.DisplayName
                  _outlook_calendar_data.due_start = _outlook_calendar_data_list[i].Start.DateTime
                  _outlook_calendar_data.due_end = _outlook_calendar_data_list[i].End.DateTime
                  _outlook_calendar_data.guests = _outlook_calendar_data_list[i].Attendees
                  _outlook_calendar_data.event_id = _outlook_calendar_data_list[i].Id
                  data.push(_outlook_calendar_data)
              }
              return res.send({
                status: true,
                data
              })
            }
          }
        });
    }else{
      const oauth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      )

      const token = JSON.parse(currentUser.google_refresh_token)
      oauth2Client.setCredentials({refresh_token: token.refresh_token}) 
      calendarList(oauth2Client, data, res)
    }
  }else{
    data = await Appointment.find({user: currentUser.id, del: false})

    if (!data) {
      return res.status(401).json({
        status: false,
        error: 'Activity doesn`t exist'
      })
    }
    return res.send({
      status: true,
      data
    })
  }
}

const calendarList = (auth, data, res) => {

  const calendar = google.calendar({version: 'v3', auth})
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, _res) => {
    if (err){
      console.log('The API returned an error: ' + err)
    } else{
      const events = _res.data.items
      if (events.length) {
        events.map((event) => {
          let _gmail_calendar_data = {}
                _gmail_calendar_data.title = event.summary
                _gmail_calendar_data.description = event.description
                _gmail_calendar_data.location = event.location
                _gmail_calendar_data.due_start = event.start.dateTime
                _gmail_calendar_data.due_end = event.end.dateTime
                _gmail_calendar_data.guests = event.attendees
                _gmail_calendar_data.type = 2
                data.push(_gmail_calendar_data)
        });
      } else {
        console.log('No upcoming events found.');
      }
      res.send({
        status: true,
        data: data
      })
    }  
  });
}

const create = async(req, res) => {
  const { currentUser } = req
  const _appointment = req.body
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }

  let event_id

  if(currentUser.connect_calendar){
    if( currentUser.connected_email_type == 'outlook' ){
      let newEvent = {
        "Subject": _appointment.title,
        "Body": {
            "ContentType": "HTML",
            "Content": _appointment.description
        },
        "Location": {
          "DisplayName": _appointment.location
        },
        "Start": {
          "DateTime":  _appointment.due_start,
          "TimeZone":"UTC" + currentUser.time_zone
        },
        "End": {
          "DateTime":  _appointment.due_end,
          "TimeZone":"UTC" + currentUser.time_zone
        },
      };

      let token = oauth2.accessToken.create({ refresh_token: currentUser.outlook_refresh_token, expires_in: 0})
      let accessToken
      
      await new Promise((resolve, reject) => {
        token.refresh(function(error, result) {
          if (error) {
            reject(error.message)
          }else {
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
      
      outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');
      outlook.calendar.createEvent(createEventParameters, function(error, event) {
        if (error) {
          console.log(error);
        }
        event_id = event.Id
      })
    }else{
      const oauth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      )
      const token = JSON.parse(currentUser.google_refresh_token)
      oauth2Client.setCredentials({refresh_token: token.refresh_token})
      addGoogleCalendarById(oauth2Client, currentUser, _appointment).then((res)=>{
        event_id = res
      }).catch((error) => {
        console.log('error', error)
      })
    }
  }

  const appointment = new Appointment({
    ...req.body,
    user: currentUser.id,
    type: 0,
    event_id: event_id,
    updated_at: new Date(),
    created_at: new Date(),
  })
  
  appointment.save()
  .then(_appointment => {

    const activity = new Activity({
      content: currentUser.user_name + ' added appointment',
      contacts: _appointment.contact,
      appointments: _appointment.id,
      user: currentUser.id,
      type: 'appointments',
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      myJSON = JSON.stringify(_appointment)
      const data = JSON.parse(myJSON);
      data.activity = _activity
      res.send({
        status: true,
        data
      })
    })
  })
  .catch(e => {
      let errors
    if (e.errors) {
        console.log('e.errors', e.errors)
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

const addGoogleCalendarById = async (auth, user, appointment) => {
  const calendar = google.calendar({version: 'v3', auth})
  let event = {
    'summary': appointment.title,
    'location': appointment.location,
    'description': appointment.description,
      'start': {
        'dateTime': appointment.due_start,
        'timeZone': 'UTC' + user.time_zone,
      },
      'end': {
        'dateTime': appointment.due_end,
        'timeZone': 'UTC' + user.time_zone,
      },
    }
  return new Promise((resolve, reject) => {
    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      resource: event,
    }, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        reject(err)
      }
      console.log('event.data.id', event.data.id)
      resolve(event.data.id) 
    })
  })
}

const edit = async(req, res) => {
  const { currentUser } = req
  const editData = req.body
  const appointment = await Appointment.findOne({user: currentUser.id, _id: req.params.id});

  if (!editData) {
    return res.status(401).json({
      status: false,
      error: 'Invalid_permission'
    })
  }

  for (let key in editData) {
    appointment[key] = editData[key]
  }

  appointment["updated_at"] = new Date()

  appointment.save().then((_appointment)=>{
    if(currentUser.connect_calendar){
      if( currentUser.connected_email_type == 'outlook' ){
        let token = oauth2.accessToken.create({ refresh_token: currentUser.outlook_refresh_token, expires_in: 0})
        
        new Promise((resolve, reject) => {
          token.refresh(function(error, result) {
            if (error) {
              reject(error.message)
            } else {
              resolve(result.token);
            }
          })
        }).then((token)=>{
          const accessToken = token.access_token
          const updatePayload = {
            "Subject": _appointment.title,
            "Body": {
                "ContentType": "HTML",
                "Content": _appointment.description
            },
            "Location": {
              "DisplayName": _appointment.location
            },
            "Start": _appointment.due_start,
            "End": _appointment.due_end,
        }
        
        const updateEventParameters = {
          token: accessToken,
          eventId: _appointment.event_id,
          update: updatePayload
        };
        
        outlook.calendar.updateEvent(updateEventParameters, function(error) {
          if (error) {
            console.log(error);
          }
        });
        res.send({
          status: true,
          data: _appointment
        })
        }).catch((error) => {
          console.log('error', error)
        })
      }else{
      const oauth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      )
      const token = JSON.parse(currentUser.google_refresh_token)
      oauth2Client.setCredentials({refresh_token: token.refresh_token})
      updateGoogleCalendarById(oauth2Client, _appointment, res)
      }
    }else{
      res.send({
        status: true,
        data: _appointment
      })
    }
  })
}

const remove = async(req, res) => {
  const { currentUser } = req
  const appointment = await Appointment.findOne({user: currentUser.id, _id: req.params.id});

  if(currentUser.connect_calendar){
    if( currentUser.connected_email_type == 'outlook' ){    
      let token = oauth2.accessToken.create({ refresh_token: currentUser.outlook_refresh_token, expires_in: 0})
      let accessToken
      
      await new Promise((resolve, reject) => {
        token.refresh(function(error, result) {
          if (error) {
            reject(error.message)
          } else {
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
        eventId: appointment.event_id
      }
    
      outlook.calendar.deleteEvent(deleteEventParameters, function(error, event) {
        if (error) {
          console.log(error);
        }
      })
    }
  }else{
    const oauth2Client = new google.auth.OAuth2(
      config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
      config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
      urls.GMAIL_AUTHORIZE_URL
    )
    oauth2Client.setCredentials(JSON.parse(currentUser.google_refresh_token)) 
    removeGoogleCalendarById(oauth2Client, appointment.event_id, res)
  }

  appointment['del'] = true
  appointment["updated_at"] = new Date()

  await appointment.save()
  res.send({
    status: true,
  })
}

const removeGoogleCalendarById = async (auth, event_id, res) => {
  const calendar = google.calendar({version: 'v3', auth})
  const params = {
      calendarId: 'primary',
      eventId: event_id,
  };
  calendar.events.delete(params, function(err) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
  })

  return res.send({
    status: true
  })
}

const updateGoogleCalendarById = async (auth, appointment, res) => {
  const calendar = google.calendar({version: 'v3', auth})
  let event = {
    'summary': appointment.title,
    'location': appointment.location,
    'description': appointment.description,
      'start': {
        'dateTime': appointment.due_start,
        'timeZone': 'UTC' + currentUser.time_zone,
      },
      'end': {
        'dateTime': appointment.due_end,
        'timeZone': 'UTC' + currentUser.time_zone,
      },
    }
    console.log('event_id', appointment.event_id)
    const params = {
      calendarId: 'primary',
      eventId: appointment.event_id,
      resource: event
    };
    calendar.events.patch(params, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
    })

    return res.send({
      status: true,
      data: appointment
    })
}

module.exports = {
    get,
    create,
    edit,
    remove
}