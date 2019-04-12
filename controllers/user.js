const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const User = require('../models/user')
const UserLog = require('../models/user_log')
const nodemailer = require('nodemailer')

const signUp = async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        error: errors.array()
      })
    }

    // const transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_DOMAIN,
    //   port: process.env.SMTP_PORT || 587,
    //   secure: !!process.env.SMTP_SECURE, // true for 465, false for other ports
    //   auth: {
    //     user: process.env.SMTP_USER, // generated ethereal user
    //     pass: process.env.SMTP_PASS // generated ethereal password
    //   }
    // })
    const hash = await bcrypt.hash(req.body.password, 8)

    const user = new User({
      ...req.body,
      password: hash,
      role: 'user',
      updated_at: new Date(),
      created_at: new Date(),
    })
    console.log('req.body',req.body)
    user.save()
    .then(_res => {
      // const msg = {
      //   to: user.email,
      //   from: process.env.BUSINESS_EMAIL,
      //   subject: process.env.WELCOME_SUBJECT,
      //   text: process.env.WELCOME_CONTENT,
      //   html: process.env.WELCOME_CONTENT,
      // };
      
      // transporter.sendMail(msg).then(() => {
      //   myJSON = JSON.stringify(_res)
      //     const data = JSON.parse(myJSON);
      //     delete data.password
      //     res.send({
      //       status: true,
      //       data
      //     })
      // }).catch(e => {
      //   let errors
      //   if (e.errors) {
      //     errors = e.errors.map(err => {      
      //       delete err.instance
      //       return err
      //     })
      //   }
      //   return res.status(500).send({
      //     status: false,
      //     error: errors || e
      //   })
      // });

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

  let _user = await User.findOne({ email: email })
  .exec();

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

  const user_log = new UserLog({
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  })

  user_log.save().then(_res => {
    // TODO: Include only email for now
    const token = jwt.sign({id:_user.id, exp: _res.created_at}, process.env.JWT_SECRET, {expiresIn: '1m'})
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
  }).catch(e => {
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
  
    req.currentUser = await UserLog.findOne({ _id: decoded.id,  created_at: decoded.exp,})

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

const editMe = async(req, res) =>{
  const user = req.currentUser

  const editData = req.body
  // TODO: should limit the editing fields here
  delete editData.password

  for (let key in editData) {
    user[key] = editData[key]
  }

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

const resetPasswordByOld = async (req, res) => {
  const { old_password, new_password } = req.body

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(401).json({
      status: false,
      error: errors.array()
    })
  }

  const _user = req.currentUser

  // Check password
  if (!bcrypt.compareSync(old_password, _user.password.split(' ')[0])) {
    return res.status(401).json({
      status: false,
      error: 'invalid_old_password'
    })
  }

  _user.password = await bcrypt.hash(new_password, 8)
  await _user.save()

  res.send({
    status: true
  })
}

module.exports = {
    signUp,
    login,
    editMe,
    resetPasswordByOld,
    checkAuth
}

