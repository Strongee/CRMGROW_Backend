const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')
const User = require('../models/user')
const UserLog = require('../models/user_log')
const nodemailer = require('nodemailer')
const sgMail = require('@sendgrid/mail')
const AWS = require('aws-sdk')

const ses = new AWS.SES({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
  apiVersion: "2010-12-01"
})

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
    
    // const hash = await bcrypt.hash(req.body.password, 8)
    const password = req.body.password
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex')
    const user = new User({
      ...req.body,
      salt: salt,
      hash: hash,
      updated_at: new Date(),
      created_at: new Date(),
    })

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

    // const params = {
    //   Destination: {
    //     ToAddresses: ["no-reply@teamgrow.awsapps.com"] // Email address/addresses that you want to send your email
    //   },
    //   Message: {
    //     Body: {
    //       Html: {
    //         // HTML Format of the email
    //         Charset: "UTF-8",
    //         Data:
    //           "<html><body><h1>Hello" + _res.user_name + "</h1><p>Welcome to teamgrow</p></body></html>"
    //       },
    //       Text: {
    //         Charset: "UTF-8",
    //         Data: "Hello, Welcome to Teamgrow"
    //       }
    //     },
    //     Subject: {
    //       Charset: "UTF-8",
    //       Data: "Teamgrow Web Services"
    //     }
    //   },
    //   Source: process.env.WELCOME_BUSINESS_EMAIL
    // };

    // const sendEmail = ses.sendEmail(params).promise();

    // sendEmail
    //   .then(_email => {
    //     console.log("email submitted to SES", _email);
    //     myJSON = JSON.stringify(_res)
    //     const data = JSON.parse(myJSON);
    //     delete data.hash
    //     delete data.salt
    //     res.send({
    //         status: true,
    //         data
    //     })
    //   })
    //   .catch(error => {
    //     console.log(error);
    //   })

      sgMail.setApiKey(process.env.SENDGRID_KEY);
      const msg = {
        to: _res.email,
        from: process.env.WELCOME_BUSINESS_EMAIL,
        subject: process.env.WELCOME_SUBJECT,
        text: process.env.WELCOME_CONTENT,
        html: process.env.WELCOME_CONTENT
      }

      sgMail.send(msg).then((_msg) => {
        if(_msg[0].statusCode >= 200 && _msg[0].statusCode < 400){ 
          myJSON = JSON.stringify(_res)
          const data = JSON.parse(myJSON);
          delete data.hash
          delete data.salt
          res.send({
              status: true,
              data
          })
        }else {
          res.status(404).send({
            status: false,
            error: _res[0].statusCode
          })
        }
      }).catch ((e) => {
        console.error(e)
        res.status(500).send({
          status: false,
          error: 'internal_server_error'
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
  const hash = crypto.pbkdf2Sync(password, _user.salt, 10000, 512, 'sha512').toString('hex');
  if (hash != _user.hash) {
    return res.status(401).json({
      status: false,
      error: 'Invalid email or password!'
    })
  }

  const user_log = new UserLog({
    user: _user.id,
    created_at: new Date(),
    updated_at: new Date()
  })

  await user_log.save()
  // TODO: Include only email for now
  const token = jwt.sign({id:_user.id}, process.env.JWT_SECRET, {expiresIn: '1d'})
  myJSON = JSON.stringify(_user)
  const user = JSON.parse(myJSON);
  delete user.hash
  delete user.salt

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
        error: err.message
      })
      // err
    }
  

    req.currentUser = await User.findOne({ _id: decoded.id})

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

const getMe = async(req, res) =>{
  const _user = req.currentUser
  myJSON = JSON.stringify(_user)
  const user = JSON.parse(myJSON);
  delete user.hash
  delete user.salt
  res.send({
    status: true,
    data: user
  })
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
    getMe,
    editMe,
    resetPasswordByOld,
    checkAuth
}

