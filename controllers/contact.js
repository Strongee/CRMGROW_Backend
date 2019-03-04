const { validationResult } = require('express-validator/check')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')

const getAll = async(req, res) => {
  const { currentUser } = req
  const data = await Contact.find({user: currentUser.id})

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const get = async(req, res) => {
  const { currentUser } = req
  const _contact = await Contact.findOne({user: currentUser.id, _id: req.params.id })
  const _follow_up = await FollowUp.find({user: currentUser.id, contact: req.params.id })
  const _activity = await Activity.find({user: currentUser.id, contact: req.params.id })
  myJSON = JSON.stringify(_contact)
  const contact = JSON.parse(myJSON);
  const data = await Object.assign(contact, {"follow_up": _follow_up}, {"activity": _activity});

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Contact doesn`t exist'
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

  const contact = new Contact({
    ...req.body,
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  })
  

  console.log('user', currentUser.id)
  contact.save()
  .then(_contact => {
      const activity = new Activity({
        content: currentUser.user_name + ' added contact',
        contact: _contact.id,
        user: currentUser.id,
        type: 'contact',
        created_at: new Date(),
        updated_at: new Date(),
      })

      activity.save().then(_activity => {
        myJSON = JSON.stringify(_contact)
        const data = JSON.parse(myJSON);
        data.activity = _activity
        res.send({
          status: true,
          data
        })
      })   
  })
  .catch(e => {
    console.log(e)
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

module.exports = {
    getAll,
    get,
    create,
}