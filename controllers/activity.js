const { validationResult } = require('express-validator/check')
const Activity = require('../models/activity');
const Contact = require('../models/contact')

const get = async(req, res) => {
  const { currentUser } = req
  const data = await Activity.find({user :currentUser.id});
  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Activity doesn`t exist'
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

  const activity = new Activity({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })

  activity.save()
  .then(_res => {
      const data = _res
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

const getByLastActivity = async(req, res) => {
  const { currentUser } = req
  const contacts = await Contact.find({user :currentUser.id})

  let data = []

  for (let i =0; i < contacts.length; i ++){

    const _activity = await Activity.find({user :currentUser.id, contact: contacts[i].id}).sort({_id : -1 }).limit(1);
    myJSON = JSON.stringify(_activity[0])
    const activity = JSON.parse(myJSON)
    delete activity.contact
    activity.contact = contacts[i]
    data.push(activity)
  }
  
  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Activity doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

module.exports = {
    get,
    create,
    getByLastActivity
}