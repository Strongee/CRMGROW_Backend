const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const User = require('../models/user')

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

const login = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(401).json({
      status: false,
      error: errors.array()
    })
  }

  const { email, password, user_name } = req.body
  if (!email && !user_name) {
    return res.status(401).json({
      status: false,
      error: 'missing_email_user_name'
    })
  }

  console.info('User Name:', email || user_name)

  let _user = await User.findOne({ email: email })
  .exec();

  console.log('_user', _user);

  if(!_user) {
    _user = await User.findOne({ user_name: user_name })
    .exec();  
  }

  if (!_user) {
    return res.status(401).json({
      status: false,
      error: 'Invalid email or password!'
    })
  }

  // Check password
  if (!bcrypt.compareSync(password, _user.password.split(' ')[0])) {
    return res.status(401).json({
      status: false,
      error: 'Invalid email or password!'
    })
  }

  // TODO: Include only email for now
  const token = jwt.sign({id:_user.id}, process.env.JWT_SECRET)
  myJSON = JSON.stringify(_user)
  const user = JSON.parse(myJSON);
  delete user.password

  // prevent user's password to be returned
  delete user.password
  res.send({
    status: true,
    data: {
      token,
      user
    }
  })
}
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
  
    req.currentUser = await User.findOne({ _id: decoded.id })

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
    login,
    checkAuth,
}