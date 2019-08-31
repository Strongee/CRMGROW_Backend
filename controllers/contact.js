const { validationResult } = require('express-validator/check')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Appointment = require('../models/appointment')
const Email = require('../models/email')
const Note = require('../models/note')
const sgMail = require('@sendgrid/mail')
const fs = require('fs')
const csv = require('csv-parser')
const config = require('../config/config')

const getAll = async(req, res) => {
  const { currentUser } = req
  const data = await Contact.find({user: currentUser.id}).sort({first_name: 1})

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
  const _activity_list = await Activity.find({user: currentUser.id, contacts: req.params.id }).sort({updated_at : 1 })
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

  let contact_old = await Contact.findOne({user: currentUser.id, email: req.body['email']}) 
  if(contact_old != null){
    return res.send({
      status: false,
      error: 'Email must be unique!'
    })
  }
  if(typeof req.body['cell_phone'] != 'undefined'){
    contact_old = await Contact.findOne({user: currentUser.id, cell_phone: req.body['cell_phone']}) 
    if(contact_old != null){
      return res.send({
        status: false,
        error: 'Phone number must be unique!'
      })
    }
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
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const {currentUser} = req
  const {cc, bcc, to, subject, content, contacts} = req.body
  
  const msg = {
    from: currentUser.email,
    subject: subject,
    to: to,
    cc: cc,
    bcc: bcc,
    html: content + '<br/><br/>' + currentUser.email_signature,
  };
      
  sgMail.send(msg).then()
  const email = new Email({
    ...req.body,
    user: currentUser.id,
    updated_at: new Date(),
    created_at: new Date()
  })

  const _email = await email.save().then()
  let data_list = []
  for(let i = 0; i < contacts.length; i ++){
    const activity = new Activity({
      content: currentUser.user_name + ' sent email',
      contacts: contacts[i],
      user: currentUser.id,
      type: 'emails',
      emails: _email.id,
      created_at: new Date(),
      updated_at: new Date(),
    })
    
    const _activity = await activity.save().then()
    myJSON = JSON.stringify(_email)
    const data = JSON.parse(myJSON);
    data.activity = _activity
    data_list.push(data)
  }
        
  res.send({
    status: true,
    data: data_list
  })
         
}

const sendEmail = async(req, res) => {
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)

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
  const {currentUser} = req
  let csv_id = 1;
  let failure = []
  fs.createReadStream(file.path).pipe(csv())
      .on('data', async(data) => {
        console.log('data', data)
        let contact_old_email = ''
        let contact_old_phone = ''
        csv_id +=1;
        if(data['email'] != null){
          contact_old_email = await Contact.findOne({user: currentUser.id, email: data['email']})
        }
        if(data['phone'] !=null){
          let cell_phone = data['phone']
          let cleaned = ('' + cell_phone).replace(/\D/g, '')
          let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
          if (match) {
              let intlCode = (match[1] ? '+1 ' : '')
              cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
          }
          contact_old_phone = await Contact.findOne({user: currentUser.id, cell_phone: cell_phone}) 
        }
        if(data['email'] == null && data['phone'] == null) return;
        if(data['first_name'] != 'first_name' && contact_old_email == null && contact_old_phone == null){
          const contact = new Contact({
            ...data,
            cell_phone: cell_phone,
            user: currentUser.id,
            created_at: new Date(),
            updated_at: new Date(),
          })
          
          contact.save().then((_contact)=>{
            const activity = new Activity({
              content: currentUser.user_name + ' added contact',
              contacts: _contact.id,
              user: currentUser.id,
              type: 'contacts',
              created_at: new Date(),
              updated_at: new Date(),
            })
            activity.save()
            if(data['note'] != null){
              const note = new Note({
                content: data['note'],
                contact: _contact.id,
                user: currentUser.id,
                created_at: new Date(),
                updated_at: new Date(),
              })
              note.save().then((_note)=>{
                const _activity = new Activity({
                  content: currentUser.user_name + ' added note',
                  contacts: _contact.id,
                  user: currentUser.id,
                  type: 'notes',
                  notes: _note.id,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                _activity.save().catch(err=>{
                  console.log(err)
                })
              })
            }
            if(data['tag'] != null){
              const tags = data['tag'].split(' ')
              tags.forEach(_tag => {
                const tag = new Tag({
                  content: _tag,
                  user: currentUser.id,
                  updated_at: new Date(),
                  created_at: new Date(),
                })
                tag.save().catch(err=>{
                  console.log(err)
                })
              });
            }
          })             
        }else{
          const field = {
            id: csv_id,
            email: data['email'],
            phone: data['phone']
          }
          failure.push(field)
        }
      }).on('end', () => {
        console.log('failure', failure)
        return res.send({
          status: true,
          failure
        })             
    });
}

const exportCSV = async(req, res) =>{
  const { currentUser } = req
  const { contacts } = req.body

  let data = []
  for(let i = 0; i < contacts.length; i ++){
    const _note = await Note.find({user :currentUser.id, contact: contacts[i]})
    if(_note.length!= 0){
      const _data = {"contact": contacts[i], "note": _note}
      data.push(_data)
    }
  }
  
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

module.exports = {
    getAll,
    get,
    create,
    remove,
    edit,
    sendBatch,
    sendEmail,
    importCSV,
    exportCSV
}