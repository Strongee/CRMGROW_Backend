const { validationResult } = require('express-validator/check')
const outlook = require('node-outlook')
const moment = require('moment')
const config = require('../config/config')
const urls = require('../constants/urls')
const time_zone = require('../constants/time_zone')
const mail_contents = require('../constants/mail_contents')
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');
const Reminder = require('../models/reminder');
const User = require('../models/user');
const credentials = {
  clientID: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token'
}
const oauth2 = require('simple-oauth2')(credentials)
const {google} = require('googleapis')
const sgMail = require('@sendgrid/mail')

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
          console.log('err',JSON.stringify(error))
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
                console.log('_outlook_calendar_data_list', _outlook_calendar_data_list)
                for(let i = 0; i < _outlook_calendar_data_list.length; i++){
                  let guests = [];
                  if(typeof _outlook_calendar_data_list[i].Attendees != "undefined"){
                    for( let j = 0; j <_outlook_calendar_data_list[i].Attendees.length; j ++){
                      const guest = _outlook_calendar_data_list[i].Attendees[j]["EmailAddress"]["Address"]
                      guests.push(guest)
                    }
                  }
                  let  _outlook_calendar_data = {}
                  _outlook_calendar_data.title = _outlook_calendar_data_list[i].Subject
                  if(typeof _outlook_calendar_data_list[i].Body != 'undefined'){
                    _outlook_calendar_data.description = _outlook_calendar_data_list[i].Body.Content
                  }else{
                    _outlook_calendar_data.description = ''
                  }
                  if(typeof _outlook_calendar_data_list[i].Location != 'undefined'){
                    _outlook_calendar_data.location = _outlook_calendar_data_list[i].Location.DisplayName
                  }else{
                    _outlook_calendar_data.location = ''
                  }
                  if(typeof  _outlook_calendar_data_list[i].Start != 'undefined'){
                    _outlook_calendar_data.due_start = _outlook_calendar_data_list[i].Start.DateTime
                  }else{
                    _outlook_calendar_data.due_start = ''
                  }
                  if(typeof  _outlook_calendar_data_list[i].End != 'undefined'){
                    _outlook_calendar_data.due_end = _outlook_calendar_data_list[i].End.DateTime
                  }else{
                    _outlook_calendar_data.due_end = ''
                  }
                  _outlook_calendar_data.guests = guests
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
          let guests = [];
          if(typeof event.attendees != "undefined"){
            for( let j = 0; j < event.attendees.length; j ++){
              const guest = event.attendees[j]['email']
              guests.push(guest)
            }
          }
          let _gmail_calendar_data = {}
                _gmail_calendar_data.title = event.summary
                _gmail_calendar_data.description = event.description
                _gmail_calendar_data.location = event.location
                _gmail_calendar_data.due_start = event.start.dateTime
                _gmail_calendar_data.due_end = event.end.dateTime
                _gmail_calendar_data.guests = guests
                _gmail_calendar_data.event_id = event.id
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
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }

  let event_id

  if(currentUser.connect_calendar){
    const _appointment = req.body
    if( currentUser.connected_email_type == 'outlook' ){
      let attendees = [];
       if(typeof _appointment.guests !='undefined' ){
          for( let j = 0; j<_appointment.guests.length; j ++){
            const addendee = {
              "EmailAddress": {
                "Address": _appointment.guests[j]
              }
            }
            attendees.push(addendee)
        }
       }   
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
        "Attendees": attendees
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

      await new Promise((resolve, reject) => {
        outlook.calendar.createEvent(createEventParameters, function(error, event) {
          if (error) {
            console.log('err', error);
            reject(error)
          }
          resolve(event.Id)
        })
      }).then((eventId)=>{
        event_id = eventId
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
      event_id = await addGoogleCalendarById(oauth2Client, currentUser, _appointment)
    }

    const appointment = new Appointment({
      ...req.body,
      user: currentUser.id,
      type: 0,
      event_id: event_id,
      updated_at: new Date(),
      created_at: new Date(),
    })
    
    appointment.save().then(_appointment => {

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
        return res.send({
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
  }else{

    const appointment = new Appointment({
      ...req.body,
      user: currentUser.id,
      type: 0,
      updated_at: new Date(),
      created_at: new Date(),
    })
    
    const _appointment = await appointment.save().then().catch(err=>{
      console.log('err', err)
      return res.status(500).send({
        status: false,
        error: 'internal_server_error'
      })
    });
    
    const due_date = new Date(_appointment.due_start)
    const due_start = new Date(_appointment.due_start).toISOString().replace(/-|:|\.\d\d\d/g,"")
    const due_end = new Date(new Date(_appointment.due_start).setDate(due_date.getDate() + 1)).toISOString().replace(/-|:|\.\d\d\d/g,"");
    const ctz = time_zone[currentUser.time_zone]

    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)

    for(let i = 0; i<_appointment.guests.length; i++){
      new Promise((resolve, reject) => {
        const msg = {
          to: _appointment.guests[i],
          from: currentUser.email,
          templateId: config.SENDGRID.SENDGRID_APPOITMENT_TEMPLATE,
          dynamic_template_data: {
            event_title: _appointment.title,
            description: _appointment.description,
            event_time: moment(_appointment.due_start).utcOffset(currentUser.time_zone).format("dddd, MMMM Do YYYY HH:mm") + ' - ' + moment(_appointment.due_end).utcOffset(currentUser.time_zone).format("HH:mm") + ' UTC '+ currentUser.time_zone,
            event_address: _appointment.location,
            organizer: currentUser.user_name,
            add_google_calendar: "<a href='" + urls.GOOGLE_CALENDAR_URL+ encodeURI(`text=${_appointment.title}&dates=${due_start}/${due_end}&ctz=${ctz}&details=${_appointment.description}&location=${_appointment.location}&add=${_appointment.guests.slice(1)}`)+"  style='border: 1px solid #dadce0;font-size: .875rem;letter-spacing: .25px;background: none;border-radius: 4px;color: #5f6368;cursor: pointer;font-weight: 500;height: 36px;text-decoration: none;display: inline-block;padding: 5px 5px;'>Add to my google calendar</a>",
            accept_invitation: `<a href='${urls.ACCEPT_INVITATION_URL}contact=${_appointment.guests[i]}&appointment=${_appointment.id}' style='border: 1px solid #dadce0;font-size: .875rem;letter-spacing: .25px;background: none;border-radius: 4px;color: #5f6368;cursor: pointer;font-weight: 500;height: 36px;text-decoration: none;display: inline-block;padding: 5px 5px;'>Accept</a>`,
            decline_invitation: `<a href='${urls.DECLINE_INVITATION_URL}contact=${_appointment.guests[i]}&appointment=${_appointment.id}' style='border: 1px solid #dadce0;font-size: .875rem;letter-spacing: .25px;background: none;border-radius: 4px;color: #5f6368;cursor: pointer;font-weight: 500;height: 36px;text-decoration: none;display: inline-block;padding: 5px 5px;'>Decline</a>`,
            email_signature: currentUser.email_signature,
          }
        }
        sgMail.send(msg).then((_res) => {
          console.log('mailres.errorcode', _res[0].statusCode);
          if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){
            console.log('status', _res[0].statusCode)
            resolve()
          }
        }).catch ((err) => {
          console.error('err', err)
          resolve()
        })
      })
    }
    
    const mins = new Date(_appointment.due_start).getMinutes()-30 
    let rdue_date = new Date(_appointment.due_start).setMinutes(mins)
    const reminder = new Reminder({
      contact: _appointment.contact,
      due_date: rdue_date,
      type: 'appointment',
      user: currentUser.id,
      appointment: _appointment.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    reminder.save().catch(err=>{
      console.log('error', err)
    })

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
      return res.send({
        status: true,
        data
      })
    }).catch(err=>{
      console.log('err', err)
      return res.status(500).send({
        status: false,
        error: 'internal_server_error'
      })
    })
  }
}

const addGoogleCalendarById = async (auth, user, appointment) => {
  const calendar = google.calendar({version: 'v3', auth})
  let attendees = [];
  if(typeof appointment.guests !='undefined' ){
    for( let j = 0; j<appointment.guests.length; j ++){
      const addendee = {
        "email": appointment.guests[j] 
      }
      attendees.push(addendee)
    }
  }
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
      'attendees': attendees
    }
  return new Promise((resolve, reject) => {
    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      sendNotifications: true,
      resource: event,
    }, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        reject(err)
      }
      resolve(event.data.id) 
    })
  })
}

const edit = async(req, res) => {
  const { currentUser } = req
  
  if(currentUser.connect_calendar){
    const _appointment = req.body
    let event_id = req.params.id
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
          let attendees = [];
          if(typeof _appointment.guests !='undefined' ){
            for( let j = 0; j<_appointment.guests.length; j ++){
              const addendee = {
                "EmailAddress": {
                  "Address": _appointment.guests[j]
                }
              }
              attendees.push(addendee)
            }
        }
          const updatePayload = {
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
            "Attendees": attendees
        }
        
        const updateEventParameters = {
          token: accessToken,
          eventId: event_id,
          update: updatePayload
        };

        outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0')
        outlook.calendar.updateEvent(updateEventParameters, function(error) {
          if (error) {
            console.log('err', error);
            return;
          }
        });
      })
    }else{
      const oauth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      )
      
      const token = JSON.parse(currentUser.google_refresh_token)
      oauth2Client.setCredentials({refresh_token: token.refresh_token})
      await updateGoogleCalendarById(oauth2Client, event_id, _appointment, currentUser.time_zone)
    }

    let appointment = await Appointment.findOne({user: currentUser.id, event_id: req.params.id})
    if(appointment){
      for (let key in _appointment) {
        appointment[key] = _appointment[key]
      }
    
      appointment["updated_at"] = new Date()
    
      appointment.save() 
      const activity = new Activity({
        content: currentUser.user_name + ' updated appointment',
        contacts: _appointment.contact,
        appointments: appointment._id,
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
      }).catch(e => {
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
    }else{
      res.send({
        status: true,
      })
    } 
  }else{
    const editData = req.body
    let appointment = await Appointment.findOne({user: currentUser.id, _id: req.params.id})
      for (let key in editData) {
        appointment[key] = editData[key]
      }
    
      appointment["updated_at"] = new Date()
    
      await appointment.save().then(_appointment=>{
        const activity = new Activity({
          content: currentUser.user_name + ' updated appointment',
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
      }).catch(e => {
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
}

const remove = async(req, res) => {
  const { currentUser } = req
 
  if(currentUser.connect_calendar){
      let event_id = req.params.id
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
          eventId: event_id
        }
      
        outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0')
        outlook.calendar.deleteEvent(deleteEventParameters, function(error) {
          if (error) {
            console.log('err',error);
          }
        })
    }else{
      const oauth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      )
      oauth2Client.setCredentials(JSON.parse(currentUser.google_refresh_token)) 
      await removeGoogleCalendarById(oauth2Client, event_id)
    }
    appointment = await Appointment.findOne({user: currentUser.id, event_id: req.params.id})

    if(appointment){
      appointment['del'] = true
      appointment["updated_at"] = new Date()

      appointment.save()
      const activity = new Activity({
        content: currentUser.user_name + ' removed appointment',
        contacts: appointment.contact,
        appointments: appointment.id,
        user: currentUser.id,
        type: 'appointments',
        created_at: new Date(),
        updated_at: new Date(),
      })

      activity.save().then(_activity => {
        myJSON = JSON.stringify(appointment)
        const data = JSON.parse(myJSON);
        data.activity = _activity
        res.send({
          status: true,
          data
        })
      }).catch(e => {
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
    }else{
      res.send({
        status: true,
      })
    }
  }else{
    appointment = await Appointment.findOne({user: currentUser.id, _id: req.params.id})
    if(appointment){
      appointment['del'] = true
      appointment["updated_at"] = new Date()

      appointment.save()
      const activity = new Activity({
        content: currentUser.user_name + ' removed appointment',
        contacts: appointment.contact,
        appointments: appointment.id,
        user: currentUser.id,
        type: 'appointments',
        created_at: new Date(),
        updated_at: new Date(),
      })

      activity.save().then(_activity => {
        myJSON = JSON.stringify(appointment)
        const data = JSON.parse(myJSON);
        data.activity = _activity
        res.send({
          status: true,
          data
        })
      }).catch(e => {
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
  }
}

const removeGoogleCalendarById = async (auth, event_id) => {
  const calendar = google.calendar({version: 'v3', auth})
  const params = {
      calendarId: 'primary',
      eventId: event_id,
      sendNotifications: true,
  };
  calendar.events.delete(params, function(err) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
  })
  return new Promise((resolve, reject) => {
    calendar.events.delete(params, function(err) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        reject(err);
      }
      resolve()
    })
  })
}

const updateGoogleCalendarById = async (auth, event_id, appointment, time_zone) => {
  const calendar = google.calendar({version: 'v3', auth})
  let attendees = [];
  if(typeof appointment.guests !='undefined'){
    for( let j = 0; j<appointment.guests.length; j ++){
      const addendee = {
        "email": appointment.guests[j] 
      }
      attendees.push(addendee)
    }
  }
  let event = {
    'summary': appointment.title,
    'location': appointment.location,
    'description': appointment.description,
    'start': {
        'dateTime': appointment.due_start,
        'timeZone': 'UTC' + time_zone,
      },
    'end': {
        'dateTime': appointment.due_end,
        'timeZone': 'UTC' + time_zone,
      },
    'attendees': attendees
    }
    const params = {
      calendarId: 'primary',
      eventId: event_id,
      resource: event,
      sendNotifications: true,
    }
    return new Promise((resolve, reject) => {
      calendar.events.patch(params, function(err) {
        if (err) {
          console.log('There was an error contacting the Calendar service: ' + err);
          reject(err)
        }
        resolve() 
      })
    })
}

const accept = async(req, res) =>{
  const _appointment = await Appointment.findOne({_id: req.query.appointment})
  const user = await User.findOne({_id: _appointment.user})
  const contact = req.query.contact

  const msg = {
    to: user.email,
    from: mail_contents.NOTIFICATION_APPOINTMENT.MAIL,
    subject: 'Appointment Accept Notification',
    templateId: config.SENDGRID.SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE,
    dynamic_template_data: {
      event_title: _appointment.title,
      description: _appointment.description,
      event_time: moment(_appointment.due_start).utcOffset(user.time_zone).format("dddd, MMMM Do YYYY HH:mm") + ' - ' + moment(_appointment.due_end).utcOffset(user.time_zone).format("HH:mm") + ' UTC '+ user.time_zone,
      event_address: _appointment.location,
      organizer: user.user_name,
      appointment_notification: `${contact} accepted the following appointment invitation`
    },
  }

  sgMail.send(msg).then((_res) => {
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){
      console.log('status', _res[0].statusCode)
      return res.send('Thanks for your submitting')
    }else {
      console.log('email sending err', msg.to+res[0].statusCode)
      return res.send('Sorry! Something went wrong... It couldn`t be notified to appointment organizer')
    }
  }).catch ((e) => {
    console.error(e)
    return res.send('Sorry! Something went wrong... It couldn`t be notified to appointment organizer')
  })
}

const decline = async(req, res) =>{
  const _appointment = await Appointment.findOne({_id: req.query.appointment})
  const user = await User.findOne({_id: _appointment.user})
  const contact = req.query.contact

  const msg = {
    to: user.email,
    from: mail_contents.NOTIFICATION_APPOINTMENT.MAIL,
    subject: 'Appointment Decline Notification',
    templateId: config.SENDGRID.SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE,
    dynamic_template_data: {
      event_title: _appointment.title,
      description: _appointment.description,
      event_time: moment(_appointment.due_start).utcOffset(user.time_zone).format("dddd, MMMM Do YYYY HH:mm") + ' - ' + moment(_appointment.due_end).utcOffset(user.time_zone).format("HH:mm") + ' UTC '+ user.time_zone,
      event_address: _appointment.location,
      organizer: user.user_name,
      appointment_notification: `${contact} declined the following appointment invitation`
    },
  }

  sgMail.send(msg).then((_res) => {
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){
      console.log('status', _res[0].statusCode)
      return res.send('Thanks for your submitting')
    }else {
      console.log('email sending err', msg.to+res[0].statusCode)
      return res.send('Sorry! Something went wrong... It couldn`t be notified to appointment organizer')
    }
  }).catch ((e) => {
    console.error(e)
    return res.send('Sorry! Something went wrong... It couldn`t be notified to appointment organizer')
  })
}

module.exports = {
    get,
    create,
    edit,
    remove,
    accept,
    decline
}