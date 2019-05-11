const { validationResult } = require('express-validator/check')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Appointment = require('../models/appointment')
const Email = require('../models/email')
const sgMail = require('@sendgrid/mail')
const fs = require('fs')
const csv = require('csv-parser')
const config = require('../config/config')

const getAll = async(req, res) => {
  const { currentUser } = req
  const data = await Contact.find({user: currentUser.id})

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

const get = async(req, res) => {
  const { currentUser } = req
  const _contact = await Contact.findOne({user: currentUser.id, _id: req.params.id })

  if (!_contact) {
    return res.status(401).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  const _follow_up = await FollowUp.find({user: currentUser.id, contact: req.params.id }).sort({due_date: 1})
  const _activity_list = await Activity.find({user: currentUser.id, contacts: req.params.id })
  let _activity_detail_list = [];
  
  for(let i = 0; i < _activity_list.length; i ++){
    const _activity_detail = await Activity.aggregate([
        {
         $lookup:
            {
             from:  _activity_list[i].type,
             localField: _activity_list[i].type,
             foreignField: '_id',
             as: "activity_detail"
            }
       },
       {
        $match: { "_id": _activity_list[i]._id }
        }
     ])

     _activity_detail_list.push(_activity_detail[0])
  }
    
    myJSON = JSON.stringify(_contact)
    const contact = JSON.parse(myJSON);
    const data = await Object.assign(contact, {"follow_up": _follow_up}, {"activity": _activity_detail_list});
    
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
  .then(_contact => {
      const activity = new Activity({
        content: currentUser.user_name + ' added contact',
        contacts: _contact.id,
        user: currentUser.id,
        type: 'contacts',
        created_at: new Date(),
        updated_at: new Date(),
      })

      activity.save().then(_activity => {
        myJSON = JSON.stringify(_contact)
        const data = JSON.parse(myJSON);
        data.activity = _activity
        res.send({
          status: true,
          data
        })
      })   
  })
  .catch(e => {
    console.log(e)
      let errors
    if (e.errors) {
      errors = e.errors.map(err => {      
        delete err.instance
        return err
      })
    }
    if (e.code = 11000){
      errors = "Email and Phone number must be unique!"
    }
    return res.status(200).send({
      status: false,
      error: errors || e
    })
  });
}

const remove = async(req, res) => {

  const {currentUser} = req
  const data = await Contact.findOne({user: currentUser.id, _id: req.params.id })

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Invalid_permission'
    })
  }

  await Contact.deleteOne({_id: req.params.id})
  await Activity.deleteMany({contacts: req.params.id})
  await FollowUp.deleteMany({contact: req.params.id})
  await Appointment.deleteMany({contact: req.params.id})

  res.send({
    status: true
  })
}

const edit = async(req, res) => {
  const {currentUser} = req
  const editData = req.body
  const contact = await Contact.findOne({user: currentUser.id, _id: req.params.id})

  if (!contact) {
    return res.status(401).json({
      status: false,
      error: 'Invalid_permission'
    })
  }

  for (let key in editData) {
    contact[key] = editData[key]
  }

  contact["updated_at"] = new Date()
 
  contact.save()
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

const sendBatch = async(req, res) => {
  sgMail.setApiKey(config.SENDGRID_KEY);

  const {currentUser} = req
  const {cc, bcc, to, subject, content, contact} = req.body
  const _contact = await Contact.findOne({_id: contact})
  
  const msg = {
    from: currentUser.email,
    subject: subject,
    to: to,
    cc: cc,
    bcc: bcc,
    html: content + '<br/><br/>' + currentUser.email_signature,
  };
      
  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
      const email = new Email({
        ...req.body,
        user: currentUser.id,
        updated_at: new Date(),
        created_at: new Date(),
      })
      
      email.save()
      .then(_email => {

        const activity = new Activity({
          content: currentUser.user_name + ' sent batch email',
          contacts: _contact.id,
          user: currentUser.id,
          type: 'emails',
          emails: _email.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
  
        activity.save().then(_activity => {
          myJSON = JSON.stringify(_email)
          const data = JSON.parse(myJSON);
          data.activity = _activity
          res.send({
            status: true,
            data
          })
        })   
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
}

const sendEmail = async(req, res) => {
  sgMail.setApiKey(config.SENDGRID_KEY)

  const {currentUser} = req
  const {contact, content, attachments} = req.body
  const _contact = await Contact.findOne({_id: contact})
  const msg = {
    from: currentUser.email,
    to: _contact.email,
    subject: currentUser.user_name + ' sent email',
    attachments: attachments,
    html: content + '<br/><br/>' + currentUser.email_signature
  };
      
  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
      const email = new Email({
        ...req.body,
        user: currentUser.id,
        updated_at: new Date(),
        created_at: new Date(),
      })
      
      email.save()
      .then(_email => {

        const activity = new Activity({
          content: currentUser.user_name + ' sent email',
          contacts: _contact.id,
          user: currentUser.id,
          type: 'emails',
          emails: _email.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
  
        activity.save().then(_activity => {
          myJSON = JSON.stringify(_email)
          const data = JSON.parse(myJSON);
          data.activity = _activity
          res.send({
            status: true,
            data
          })
        })   
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
}

const importCSV = async(req, res) => {
  let file = req.file
  fs.createReadStream(file.path).pipe(csv())
      .on('data', (data) => {
        const contact = new Contact({
          ...data,
          user: currentUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        
      
        console.log('user', currentUser.id)
        contact.save()
        .then(_contact => {
            const activity = new Activity({
              content: currentUser.user_name + ' added contact',
              contacts: _contact.id,
              user: currentUser.id,
              type: 'contacts',
              created_at: new Date(),
              updated_at: new Date(),
            })
      
            activity.save().then(_activity => {
              myJSON = JSON.stringify(_contact)
              const data = JSON.parse(myJSON);
              data.activity = _activity
              res.send({
                status: true,
                data
              })
            })   
        })
        .catch(e => {
          console.log(e)
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
      })
}
module.exports = {
    getAll,
    get,
    create,
    remove,
    edit,
    sendBatch,
    sendEmail,
    importCSV
}