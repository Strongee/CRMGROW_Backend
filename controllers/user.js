const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const User = require('../models/user');

const signUp = async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        error: errors.array()
      })
    }
  
    const hash = await bcrypt.hash(req.body.password, 8)
  
    const user = new User({
      ...req.body,
      password: hash,
    })
  
    let data
    try {
      const res = await user.save(function(err){
        if(err){
            console.log("Error in saving User:",err);
        }
    })
      data = res.get({plain: true})
      console.log('data', data);
      // Remove password
      delete data.password
    } catch (e) {
      // Remove password
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
    }
  
    res.send({
      status: true,
      data
    })
  }

const checkAuth = async (req, res, next) => {
    next()
}

const checkAdmin = async (req, res, next) => {
    next()
}

module.exports = {
    signUp,
    checkAuth,
    checkAdmin
}