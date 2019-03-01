const { validationResult } = require('express-validator/check')
const Note = require('../models/note');
const Activity = require('../models/activity');

const get = async(req, res) => {
  const { currentUser } = req
  const data = await Note.find({user :currentUser.id});
  console.log('data', data);
  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Note doesn`t exist'
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

  const note = new Note({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })
  console.log('req.body',req.body)
  note.save()
  .then(_note => {

    const activity = new Activity({
      content: currentUser.user_name + ' added note',
      contact: _note.contact,
      user: currentUser.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      myJSON = JSON.stringify(_note)
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