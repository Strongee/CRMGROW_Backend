const { validationResult } = require('express-validator/check')
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');

const get = async(req, res) => {
  const { currentUser } = req
  const { contact } = req.params
  const data = await Appointment.find({user :currentUser.id, contact: contact});

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
      contact: _appointment.contact,
      user: currentUser.id,
      type: 'appointment',
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

module.exports = {
    get,
    create,
}