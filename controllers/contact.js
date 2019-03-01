const { validationResult } = require('express-validator/check')
const Contact = require('../models/contact');
const Activity = require('../models/activity')

const get = async(req, res) => {
  const { currentUser } = req
  const data = await Contact.find({user :currentUser.id});

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
  

  contact.save()
  .then(_res => {
      const activity = new Activity({
        content: currentUser.user_name + 'added contact',
        contact: _res[0].id,
        user: currentUser.id,
        created_at: new Date(),
        updated_at: new Date(),
      })

      myJSON = JSON.stringify(_res)
      const data = JSON.parse(myJSON);
      data.activity = activity;

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

module.exports = {
    get,
    create,
}