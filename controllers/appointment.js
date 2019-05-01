const { validationResult } = require('express-validator/check')
const outlook = require('node-outlook')
const moment = require('moment')
const config = require('../config/config')
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
  const data = await Appointment.find({user: currentUser.id})

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
      let startDate = moment().startOf('day');
      let endDate = moment(startDate).add(7, 'days');
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
          // Requests only 5 changes per response
          'odata.maxpagesize=5'
        ]
      };
    
      let token = oauth2.accessToken.create({ refresh_token: currentUser.refresh_token, expires_in: 0})
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
      };
      
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
            }
            else {
              let nextLink = response.body['@odata.nextLink']
              if (nextLink !== undefined) {
                console.log('nextLink', nextLink)
              }
              let deltaLink = response.body['@odata.deltaLink']
              if (deltaLink !== undefined) {
                console.log('deltaLink', deltaLink)
              }
              const _outlook_calendar_data_list = response.body.value
              for(let i = 0; i< _outlook_calendar_data_list.length; i++){
                let  _outlook_calendar_data = {}
                _outlook_calendar_data.title = _outlook_calendar_data_list[i].Subject
                _outlook_calendar_data.description = _outlook_calendar_data_list[i].Body.Content
                _outlook_calendar_data.location = _outlook_calendar_data_list[i].Location.DisplayName
                _outlook_calendar_data.due_start = _outlook_calendar_data_list[i].Start.DateTime
                _outlook_calendar_data.due_end = _outlook_calendar_data_list[i].End.DateTime
                _outlook_calendar_data.guests = _outlook_calendar_data_list[i].Attendees
                _outlook_calendar_data.type = 1
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
      oauth2Client.setCredentials(JSON.parse(currentUser.refresh_token)) 
      calendarList(oauth2Client, data, res)
    }
  }else{
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
      console.log('events', events) 
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
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }

  const appointment = new Appointment({
    ...req.body,
    user: currentUser.id,
    type: 0,
    updated_at: new Date(),
    created_at: new Date(),
  })
  console.log('data', req.body)
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
    res.send({
      status: true,
      data: _appointment
    })
  })
}

module.exports = {
    get,
    create,
    edit
}