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

const login = async (re)
const checkAuth = async (req, res, next) => {
    const token = req.get('Authorization')
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      console.info('Auth Success:', decoded, ip)
    } catch (err) {
      console.error(err)
      return res.status(401).send({
        status: false,
        error: 'invalid_auth'
      })
      // err
    }
  
    req.currentUser = await User.findOne({ where: { id: decoded.id } })
  
    if (req.currentUser) {
      next()
    } else {
      console.error('Valid JWT but no user:', decoded)
      res.send({
        status: false,
        error: 'invalid_user'
      })
    }
  }

module.exports = {
    signUp,
    checkAuth,
}