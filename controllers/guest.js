const Guest = require('../models/guest');
const sgMail = require('@sendgrid/mail')
const config = require('../config/config')
const mail_contents = require('../constants/mail_contents');
const urls = require('../constants/urls')

const get = async(req, res) => {
  const data = await Guest
                    .find({_id: req.params.id});
  
  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Guest find err'
    })
  }

  return res.send({
    status: true,
    data
  })
}

const create = async(req, res) => {
  const { currentUser } = req

  const password = req.body.password
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex')
  
  const guest = new Guest({
    ...req.body,
    salt: salt,
    hash: hash,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date(),
  })
  
  guest.save().then(()=>{
    
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)
    
    let msg = {
      to: _res.email,
      from: mail_contents.INVITE_GUEST.MAIL,
      templateId: config.SENDGRID.INVITE_GUEST,
      dynamic_template_data: {
        subject:  `${mail_contents.INVITE_GUEST.SUBJECT}- ${user.user_name} has invited you to join CRMGrow`,
        user_name: currentUser.user_name,
        password: req.body.password,
        LOGIN_URL: urls.LOGIN_URL,
        LOGO_URL: urls.LOGO_URL
      },
    };

    sgMail.send(msg).catch(err => {
      console.log('err', err)
    })


    return res.send({
      status: true,
    })
  }).catch(err=>{
    console.log('err', err.message)
    return res.status(400).json({
      status: false,
      error: err.message || 'Internal server error'
    })
  })
}

const edit = async(req, res) => {
  const {currentUser} = req
  const editData = req.body
  const guest = await Guest.findOne({_id: req.params.id, user: currentUser.id}).catch(err=>{
    console.log('err', err.message)
  })

  if(!guest) {
    return res.status(404).send({
      status: false,
      error: 'invalid permission'
    })
  }
  
  for (let key in editData) {
    guest[key] = editData[key]
  }
  
  if(editData['password']) {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(editData['password'], salt, 10000, 512, 'sha512').toString('hex')
    guest['salt'] = salt
    guest['hash'] = hash
  }
  
  guest.save()
    .then(()=>{
      return res.send({
        status: true,
      })
    }).catch(err=>{
      console.log('err', err.message)
      return res.status(400).json({
        status: false,
        error: err.message || 'Internal server error'
      })
    })
  
}

module.exports = {
    get,
    create,
    edit
}