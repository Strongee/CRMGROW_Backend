const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const FollowUp = require('../models/follow_up');

const getAll = async(req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        error: errors.array()
      })
    }
  
    const user = new User({
      ...req.body,
      password: hash,
    })
    console.log('req.body',req.body)
    user.save()
    .then(data => {
        console.log('data', data)
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
}