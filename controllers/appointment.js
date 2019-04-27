const { validationResult } = require('express-validator/check')
const outlook = require('node-outlook')
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');

const get = async(req, res) => {
  const { currentUser } = req
  const data = await Appointment.find({user: currentUser.id})

  if(currentUser.connect_calendar){
  
  outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');

  outlook.base.setAnchorMailbox(currentUser.connected_email);
  // Set the preferred time zone
  outlook.base.setPreferredTimeZone(currentUser.time_zone);
  
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
  
  let apiOptions = {
    url: requestUrl,
    token: token,
    headers: headers,
    query: params
  };
  
  console.log('here')
  outlook.base.makeApiCall(apiOptions, function(error, response) {
    if (error) {
      console.log(JSON.stringify(error))
      return res.status(401).json({
        status: false,
        error: error
      })
    } else {
        if (response.statusCode !== 200) {
          console.log('API Call returned ' + response.statusCode)
          res.send('API Call returned ' + response.statusCode)
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
          const data = response.body.value
          res.send({
            status: true,
            data
          })
        }
      }
    });
  }

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Appointment doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
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