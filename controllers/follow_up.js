const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const FollowUp = require('../models/follow_up');

const getAll = async(req, res) => {
  const { currentUser } = req
  const data = await FollowUp.findOne({ user: currentUser.id })
    .exec();  

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'FollowUp doesn`t exist'
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

  const followUp = new FollowUp({
    ...req.body,
    user: currentUser.id,
  })
  console.log('req.body',req.body)
  followUp.save()
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

module.exports = {
    getAll,
    create,
}