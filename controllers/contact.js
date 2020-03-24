const { validationResult } = require('express-validator/check')
const mongoose = require('mongoose')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Appointment = require('../models/appointment')
const Email = require('../models/email')
const Note = require('../models/note')
const User = require('../models/user')
const Video = require('../models/video')
const PDF = require('../models/pdf')
const TimeLine = require('../models/time_line')
const EmailTracker = require('../models/email_tracker')
const Reminder = require('../models/reminder')
const Garbage = require('../models/garbage')
const sgMail = require('@sendgrid/mail')
const urls = require('../constants/urls')
const fs = require('fs')
const csv = require('csv-parser')
const config = require('../config/config')
const mail_contents = require('../constants/mail_contents')
const webpush = require('web-push');
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const moment = require('moment')

const getAll = async (req, res) => {
  const { currentUser } = req
  const data = await Contact.find({ user: currentUser.id })

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  return res.send({
    status: true,
    data
  })
}

const getAllByLastActivity = async (req, res) => {
  const { currentUser } = req
  const data = await Contact.find({ user: currentUser.id }).populate('last_activity').sort({ first_name: 1 }).catch(err => {
    console.log('err', err)
  })


  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const getByLastActivity = async (req, res) => {
  const { currentUser } = req
  let contacts
  if (typeof req.params.id == 'undefined') {
    contacts = await Contact.find({ user: currentUser.id }).populate('last_activity').sort({ first_name: 1 }).limit(50)
  } else {
    const id = parseInt(req.params.id)
    contacts = await Contact.find({ user: currentUser.id }).populate('last_activity').sort({ first_name: 1 }).skip(id).limit(50)
  }

  if (!contacts) {
    return res.status(400).json({
      status: false,
      error: 'Contacts doesn`t exist'
    })
  }

  const count = await Contact.countDocuments({ user: currentUser.id })

  return res.send({
    status: true,
    data: {
      contacts,
      count: count
    }
  })
}

const get = async (req, res) => {
  const { currentUser } = req
  const _contact = await Contact.findOne({ user: currentUser.id, _id: req.params.id })
  const next_contact = await Contact.find({_id: {$gt: req.params.id}, user: currentUser.id}).sort({ first_name: 1, _id: 1 }).limit(1)
  const prev_contact = await Contact.find({_id: {$lt: req.params.id}, user: currentUser.id}).sort({ first_name: -1, _id: -1 }).limit(1)
  let next = null
  let prev = null
  if(next_contact[0]){
    next = next_contact[0].id
  }
  if(prev_contact[0]){
    prev = prev_contact[0].id
  }
  contacts = await Contact.find({ user: currentUser.id }).populate('last_activity').sort({ first_name: 1 }).limit(15)
  if (!_contact) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  const _follow_up = await FollowUp.find({ user: currentUser.id, contact: req.params.id, status: {$ne: -1}}).sort({ due_date: 1 })
  const _timelines = await TimeLine.find({ user: currentUser.id, contact: req.params.id}).sort({due_date: 1}).catch(err=>{
    console.log('err', err)
  })
  const _activity_list = await Activity.find({ user: currentUser.id, contacts: req.params.id }).sort({ updated_at: 1 })
  let _activity_detail_list = [];

  for (let i = 0; i < _activity_list.length; i++) {
    const _activity_detail = await Activity.aggregate([
      {
        $lookup:
        {
          from: _activity_list[i].type,
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
  const data = await Object.assign(contact, 
      { "follow_up": _follow_up }, 
      { "activity": _activity_detail_list }, 
      { "next": next},
      { "prev": prev},
      { "time_lines": _timelines}
    );

  return res.send({
    status: true,
    data
  })
}

const create = async (req, res) => {
  const { currentUser } = req
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: false,
      error: errors.array()
    })
  }
  let max_count = 0
  let count = 0

  if (!currentUser.contact) {
    count = await Contact.countDocuments({ user: currentUser.id })
    max_count = config.MAX_CONTACT
  } else {
    count = currentUser.contact.count
    max_count = currentUser.contact.max_count
  }

  if (max_count < count) {
    return res.status(400).send({
      status: false,
      error: 'You are exceed for max contacts'
    })
  }

  let contact_old
  if (typeof req.body['email'] != 'undefined') {
    contact_old = await Contact.findOne({ user: currentUser.id, email: req.body['email'] })
    if (contact_old != null) {
      return res.status(400).send({
        status: false,
        error: 'Email must be unique!'
      })
    }
  }

  if (typeof req.body['cell_phone'] != 'undefined') {
    contact_old = await Contact.findOne({ user: currentUser.id, cell_phone: req.body['cell_phone'] })
    if (contact_old != null) {
      return res.status(400).send({
        status: false,
        error: 'Phone number must be unique!'
      })
    }
  }

  let cell_phone = req.body.cell_phone
  let cleaned = ('' + cell_phone).replace(/\D/g, '')
  let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
  if (match) {
    let intlCode = (match[1] ? '+1 ' : '')
    cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
  }

  const contact = new Contact({
    ...req.body,
    cell_phone: cell_phone,
    user: currentUser.id,
    created_at: new Date(),
    updated_at: new Date(),
  })

  contact.save()
    .then(_contact => {
      count += 1
      const contact_info = {
        count: count,
        max_count: max_count
      }
      currentUser.contact_info = contact_info
      currentUser.save()
      const activity = new Activity({
        content: 'added contact',
        contacts: _contact.id,
        user: currentUser.id,
        type: 'contacts',
        created_at: new Date(),
        updated_at: new Date(),
      })

      activity.save().then(_activity => {
        _contact['last_activity'] = _activity.id
        _contact.save().catch(err => {
          console.log('err', err)
        })
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
      if (e.code = 11000) {
        errors = "Email and Phone number must be unique!"
      }
      return res.status(500).send({
        status: false,
        error: errors || e
      })
    });
}

const remove = async (req, res) => {

  const { currentUser } = req
  const data = await Contact.findOne({ user: currentUser.id, _id: req.params.id })

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission'
    })
  }

  await Contact.deleteOne({ _id: req.params.id })
  await Activity.deleteMany({ contacts: req.params.id })
  await FollowUp.deleteMany({ contact: req.params.id })
  await Appointment.deleteMany({ contact: req.params.id })
  await Reminder.deleteMany({ contact: req.params.id })
  await TimeLine.deleteMany({contact: req.params.id})

  res.send({
    status: true
  })
}

const removeContacts = async (req, res) => {

  const { currentUser } = req
  const ids = req.body.ids;
  var deleted = 0;
  var undeleted = 0;
  ids.forEach(id => {
    if (removeContact(currentUser.id, id)) {
      deleted++;
    }
    else {
      undeleted++;
    }
  })

  return res.send({
    status: true,
    data: {
      deleted: deleted,
      undeleted: undeleted
    }
  })
}

const removeContact = async (user_id, id) => {
  const data = await Contact.findOne({ user: user_id, _id: id })
  if (!data) {
    return false;
  }

  await Contact.deleteOne({ _id: id })
  await Activity.deleteMany({ contacts: id })
  await FollowUp.deleteMany({ contact: id })
  await Appointment.deleteMany({ contact: id })
  await Reminder.deleteMany({ contact: id })
  await TimeLine.deleteMany({contact: id})
  return true;
}

const edit = async (req, res) => {
  const { currentUser } = req
  const editData = req.body
  if(!req.params.id || req.params.id === 'undefined'){
    return res.status(400).json({
      status: false,
      error: 'Invalid Contact'
    })
  } else {
    const contact = await Contact.findOne({ user: currentUser.id, _id: req.params.id }).catch(err=>{
      console.log('err', err)
    })

  for (let key in editData) {
    contact[key] = editData[key]
  }

  if (typeof req.body.cell_phone != 'undefined') {
    let cell_phone = req.body.cell_phone
    let cleaned = ('' + cell_phone).replace(/\D/g, '')
    let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
    if (match) {
      let intlCode = (match[1] ? '+1 ' : '')
      cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
    }
    contact["cell_phone"] = cell_phone
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
}

const bulkEditLabel = async (req, res) => {
  const { contacts, label } = req.body;
  Contact.find({ _id: { $in: contacts } }).updateMany({ $set: { label: label } }).then(() => {
    res.send({
      status: true
    })
  })
    .catch(err => {
      res.status(500).send({
        status: false,
        error: err.message || 'Label Update Error'
      })
    })
}

const bulkUpdate = async (req, res) => {
  const { contacts, data, tags} = req.body;
  let tagUpdateQuery = {}
  if(tags.tags && tags.tags.length) {
    switch(tags.option) {
      case 2:
        tagUpdateQuery = {$push: {tags: {$each: tags.tags}}} 
        break;
      case 3:
        tagUpdateQuery = {$pull: {tags: {$in: tags.tags}}} 
        break;
      case 4: 
        tagUpdateQuery = {tags: tags.tags}
        break;
    }
  }
  let updateQuery = {};
  if(Object.keys(data).length) {
    updateQuery = {$set: data}
  }
  if(Object.keys(tagUpdateQuery).length) {
    updateQuery = {...updateQuery, ...tagUpdateQuery}
  }
  
  Contact.find({_id: {$in: contacts}}).updateMany(updateQuery).then(() => {
    res.send({
      status: true
    })
  }).catch(err => {
    console.log("error", err);
    res.status(500).send({
      status: false,
      error: err.message || 'Update Error'
    })
  })
}

const receiveEmail = async(req, res) => {
  const message_id = req.body[0].sg_message_id.split('.')[0]
  const event = req.body[0].event
  const email = req.body[0].email
  const time_stamp = req.body[0].timestamp
  const update_data = {event: event}
  Email.findOneAndUpdate({message_id: message_id}, update_data).then(async(_email)=>{
    if(_email){
      const user = await User.findOne({_id: _email.user}).catch(err=>{
        console.log('err', err)
      })
      
      const contact = await Contact.findOne({email: email, user: user.id}).catch(err=>{
        console.log('err', err)
      })
      
      if(contact && user) {
        let opened = new Date(time_stamp*1000);
        const created_at = moment(opened).utcOffset(user.time_zone).format('h:mm a')
        let action = ''
        if(event == 'open'){
          action = 'opened'
          const email_activity = await Activity.findOne({contacts: contact.id, emails: _email.id}).catch(err=>{
            console.log('err', err)
          })
          
          let reopened = new Date(time_stamp*1000-60*60*1000)
          const old_activity = await EmailTracker.findOne({activity: email_activity.id, type: 'open', created_at: {$gte: reopened}}).catch(err=>{
            console.log('err', err)
          })
          
          if(!old_activity){
            const email_tracker = new EmailTracker({
              user: user.id,
              contact: contact.id,
              email: _email.id,
              type: 'open',
              activity: email_activity.id,
              updated_at: opened,
              created_at: opened,
            })
            const _email_tracker = await email_tracker.save().then().catch(err=>{
              console.log('err', err)
            })
            
            const activity = new Activity({
              content: 'opened email',
              contacts: contact.id,
              user: user.id,
              type: 'email_trackers',
              emails: _email.id,
              email_trackers: _email_tracker.id,
              created_at: new Date(),
              updated_at: new Date(),
            })
        
            const _activity = await activity.save().then().catch(err=>{
              console.log('err', err)
            })
            
            Contact.update({_id: contact.id}, { $set: { last_activity: _activity.id } }).catch(err => {
              console.log('err', err)
            }) 
          } else {
            return;
          }
        }
        if(event == 'click'){
          action = 'clicked the link on'
          const email_activity = await Activity.findOne({contacts: contact.id, emails: _email.id}).catch(err=>{
            console.log('err', err)
          })
          let reclicked = new Date(time_stamp*1000-60*60*1000)
          const old_activity = await EmailTracker.findOne({activity: email_activity.id, type: 'click', created_at: {$gte: reclicked}}).catch(err=>{
            console.log('err', err)
          })
          
          if(old_activity){
            return;
          }
          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: _email.id,
            type: 'click',
            activity: email_activity.id,
            updated_at: opened,
            created_at: opened,
          })
          const _email_tracker = await email_tracker.save().then().catch(err=>{
            console.log('err', err)
          })
          
          const activity = new Activity({
            content: 'clicked the link on email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: _email.id,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          })
      
          const _activity = await activity.save().then().catch(err=>{
            console.log('err', err)
          })
          
          Contact.findByIdAndUpdate(contact.id, { $set: { last_activity: _activity.id } }).catch(err => {
            console.log('err', err)
          })
        }
        if(event == 'unsubscribe'){
          action = 'unsubscribed'
          const email_activity = await Activity.findOne({contacts: contact.id, emails: _email.id}).catch(err=>{
            console.log('err', err)
          })
          const email_tracker = new EmailTracker({
            user: user.id,
            contact: contact.id,
            email: _email.id,
            type: 'unsubscribe',
            activity: email_activity.id,
            updated_at: opened,
            created_at: opened,
          })
          const _email_tracker = await email_tracker.save().then().catch(err=>{
            console.log('err', err)
          })
  
            
          const activity = new Activity({
            content: 'unsubscribed email',
            contacts: contact.id,
            user: user.id,
            type: 'email_trackers',
            emails: _email.id,
            email_trackers: _email_tracker.id,
            created_at: new Date(),
            updated_at: new Date(),
          })
      
          const _activity = await activity.save().then().catch(err=>{
            console.log('err', err)
          })
          
          Contact.update({_id: contact.id}, { $set: { last_activity: _activity.id } ,  $push: {tags: {$each: ['unsubscribed']}}}).catch(err => {
            console.log('err', err)
          })
        }
      const garbage = await Garbage.findOne({user: user.id}).catch(err=>{
        console.log('err', err)
      }) 
      const email_notification = garbage['email_notification']
      
      if(email_notification['email']){
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY); 
        const msg = {
            to: user.email,
            from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
            templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
            dynamic_template_data: {
              subject: mail_contents.NOTIFICATION_OPENED_EMAIL.SUBJECT,
              first_name: contact.first_name,
              last_name: contact.last_name,
              phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
              email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
              activity: contact.first_name + ' '+action+' email: '+ _email.subject + ' at ' + created_at,
              detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
            },
        };
        sgMail.send(msg).catch(err => console.error(err))
      }
      const desktop_notification = garbage['desktop_notification']
      if(desktop_notification['email']){
          webpush.setVapidDetails(
            'mailto:support@crmgrow.com',
            config.VAPID.PUBLIC_VAPID_KEY,
            config.VAPID.PRIVATE_VAPID_KEY
          )
          
          const subscription = JSON.parse(user.desktop_notification_subscription)
          const title = contact.first_name + ' ' + contact.last_name + ' - ' + contact.email + ' ' + action + ' email' 
          const created_at =moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') + ' at ' + moment(opened).utcOffset(user.time_zone).format('h:mm a')
          const body =contact.first_name  + ' ' + contact.last_name + ' - ' + contact.email + ' ' + action + ' email: '+_email.subject+' on ' + created_at
          const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico","badge": '/fav.ico'}})
          webpush.sendNotification(subscription, playload).catch(err => console.error(err))
      }
      const text_notification = garbage['text_notification']
      if(text_notification['email']){
        const e164Phone = phone(user.cell_phone)[0]
      
        if (!e164Phone) {
          const error = {
            error: 'Invalid Phone Number'
          }
      
          throw error // Invalid phone number
        } else {
          let fromNumber = user['proxy_number'];
          if(!fromNumber) {
            const areaCode = user.cell_phone.substring(1, 4)
        
            const data = await twilio
            .availablePhoneNumbers('US')
            .local.list({
              areaCode: areaCode,
            })
          
            let number = data[0];
        
            if(typeof number == 'undefined'){
              const areaCode1 = user.cell_phone.substring(1, 3)
        
              const data1 = await twilio
              .availablePhoneNumbers('US')
              .local.list({
                areaCode: areaCode1,
              })
              number = data1[0];
            }
            
            if(typeof number != 'undefined'){
              const proxy_number = await twilio.incomingPhoneNumbers.create({
                phoneNumber: number.phoneNumber,
                smsUrl:  urls.SMS_RECEIVE_URL
              })
              
              console.log('proxy_number', proxy_number)
              user['proxy_number'] = proxy_number.phoneNumber;
              fromNumber = user['proxy_number'];
              user.save().catch(err=>{
                console.log('err', err)
              })
            } else {
              fromNumber = config.TWILIO.TWILIO_NUMBER
            } 
          }
        
          const title = contact.first_name + ' ' + contact.last_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n'+'\n'+ action + ' email: ' +'\n'+ _email.subject + '\n'
          const created_at =moment(opened).utcOffset(user.time_zone).format('MM/DD/YYYY') + ' at ' + moment(opened).utcOffset(user.time_zone).format('h:mm a')
          const time = ' on ' + created_at + '\n '
          const contact_link = urls.CONTACT_PAGE_URL + contact.id 
          twilio.messages.create({from: fromNumber, body: title+'\n'+time +contact_link,  to: e164Phone}).catch(err=>{
            console.log('send sms err: ',err)
          })
        } 
        } 
      }
    }
  }).catch(err=>{
    console.log('err', err)
  })
  return res.send({
    status: true
  })
}

const importCSV = async (req, res) => {
  let file = req.file
  const { currentUser } = req
  let failure = []
  let count = 0
  let max_count = 0
  if (!currentUser.contact) {
    count = await Contact.countDocuments({ user: currentUser.id })
    max_count = config.MAX_CONTACT
  } else {
    count = currentUser.contact.count
    max_count = currentUser.contact.max_count
  }

  let contact_array = []
  fs.createReadStream(file.path).pipe(csv())
    .on('data', async (data) => {
      contact_array.push(data)
    }).on('end', () => {
      let promise_array = []
      for (let i = 0; i < contact_array.length; i++) {
        let promise = new Promise(async (resolve, reject) => {
          let data = contact_array[i]
          if (data['first_name'] == '') {
            data['first_name'] = null
          }
          if (data['email'] == '') {
            data['email'] = null
          }
          if (data['phone'] == '') {
            data['phone'] = null
          }
          if (data['first_name'] || data['email'] || data['phone']) {
            let cell_phone = data['phone']
            let cleaned = ('' + cell_phone).replace(/\D/g, '')
            let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
            if (match) {
              let intlCode = (match[1] ? '+1 ' : '')
              cell_phone = [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
            }
            count = count + 1;
            if (max_count < count) {
              const field = {
                id: i,
                email: data['email'],
                phone: data['phone'],
                err: 'Exceed upload max contacts'
              }
              failure.push(field)
              resolve()
              return
            }
            let tags = [];
            if (data['tags'] != '' && typeof data['tags'] != 'undefined') {
              tags = data['tags'].split(/,\s|\s,|,|\s/);
            }
            delete data.tags
            const contact = new Contact({
              ...data,
              tags: tags,
              cell_phone: cell_phone,
              user: currentUser.id,
              created_at: new Date(),
              updated_at: new Date(),
            })

            contact.save().then(_contact => {
              const activity = new Activity({
                content: 'added contact',
                contacts: _contact.id,
                user: currentUser.id,
                type: 'contacts',
                created_at: new Date(),
                updated_at: new Date(),
              })
              activity.save().then((_activity) => {
                Contact.findByIdAndUpdate(_contact.id, { $set: { last_activity: _activity.id } }).catch(err => {
                  console.log('err', err)
                })
              }).catch(err => {
                console.log('err', err)
              })
              if (data['note'] && data['note'] != '') {
                const note = new Note({
                  content: data['note'],
                  contact: _contact.id,
                  user: currentUser.id,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                note.save().then((_note) => {
                  const _activity = new Activity({
                    content: 'added note',
                    contacts: _contact.id,
                    user: currentUser.id,
                    type: 'notes',
                    notes: _note.id,
                    created_at: new Date(),
                    updated_at: new Date(),
                  })
                  _activity.save().then((__activity) => {
                    Contact.update({_id: _contact.id}, { $set: { last_activity: __activity.id } }).catch(err => {
                      console.log('err', err)
                    })
                  }).catch(err => {
                    console.log('error', err)
                  })
                })
              }
              resolve()
              return
            }).catch(err => {
              console.log('err', err)
            })
          } else {
            resolve()
          }
        })
        promise_array.push(promise)
      }

      Promise.all(promise_array).then(function () {
        const contact_info = {
          count: count,
          max_count: max_count
        }
        currentUser.contact_info = contact_info
        currentUser.save().catch(err => {
          console.log('err', err)
        })
        return res.send({
          status: true,
          failure
        })
      });
    });
}

const exportCSV = async (req, res) => {
  const { currentUser } = req
  const { contacts } = req.body

  let data = []
  for (let i = 0; i < contacts.length; i++) {
    let _data = {
      contact_id: contacts[i],
      note: []
    }
    const _note = await Note.find({ user: currentUser.id, contact: contacts[i] })
    const _contact = await Contact.findOne({ _id: contacts[i] })
    
    if (_note.length != 0) {
      _data["note"] = _note
    }
    _data["contact"] = _contact;
    data.push(_data)
  }

  if (!data) {
    return res.status(400).json({
      status: false,
      error: 'Note doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })
}

const search = async (req, res) => {
  const { currentUser } = req
  let search = req.body.search
  let contacts = []
  if (!search.split(" ")[1]) {
    contacts = await Contact.find({
      $or: [
        { first_name: { '$regex': search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id },
        { email: { '$regex': '.*' + search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id },
        { last_name: { '$regex': search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id },
        { cell_phone: { '$regex': '.*' + search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id }
      ]
    }).populate('last_activity').sort({ first_name: 1 })
  } else {
    contacts = await Contact.find({
      $or: [
        { first_name: { '$regex': search.split(" ")[0], '$options': 'i' }, last_name: { '$regex': search.split(" ")[1], '$options': 'i' }, user: currentUser.id },
        { cell_phone: search, user: currentUser.id }
      ]
    }).populate('last_activity').sort({ first_name: 1 })
  }

  const count = await Contact.countDocuments({ user: currentUser.id })

  return res.send({
    status: true,
    data: {
      contacts,
      search: search,
      total: count
    }

  })
}

const searchEasy = async (req, res) => {
  const { currentUser } = req
  let search = req.body.search
  if (!search.split(" ")[1]) {
    data = await Contact.find({
      $or: [
        { first_name: { '$regex': search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id },
        { email: { '$regex': '.*' + search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id },
        { last_name: { '$regex': search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id },
        { cell_phone: { '$regex': '.*' + search.split(" ")[0] + '.*', '$options': 'i' }, user: currentUser.id }
      ]
    }).sort({ first_name: 1 }).limit(8).catch(err => {
      console.log('err', err)
    })
  } else {
    data = await Contact.find({
      $or: [
        { first_name: search.split(" ")[0], last_name: search.split(" ")[1], user: currentUser.id },
        { cell_phone: { '$regex': search + '.*', '$options': 'i' }, user: currentUser.id }
      ]
    }).sort({ first_name: 1 }).limit(8).catch(err => {
      console.log('err', err)
    })
  }

  return res.send({
    status: true,
    data
  })
}

const getById = async (req, res) => {
  const { currentUser } = req
  const _contact = await Contact.findOne({ user: currentUser.id, _id: req.params.id })

  if (!_contact) {
    return res.status(400).json({
      status: false,
      error: 'Contact doesn`t exist'
    })
  }

  res.send({
    status: true,
    data: _contact
  })
}

const getByIds = async (req, res) => {
  const { ids } = req.body
  const _contacts = await Contact.find({
    _id: { $in: ids }
  })

  res.send({
    status: true,
    data: _contacts
  })
}

const leadContact = async (req, res) => {
  const {user, first_name, email, cell_phone, video, pdf} = req.body
  const _exists = await Contact.find({
    email,
    user
  }).catch(err => {
    return res.status(500).send({
      status: false,
      error: err.message
    })
  })

  if(_exists && _exists.length) {
    return res.json({
      status: true,
    })
  }
  else {
    const label = 'New'
    const _contact = new Contact({
      first_name,
      email,
      cell_phone,
      label,
      tags: ['leadcapture'],
      user
    })
    
    if(video){
      _contact.save().then(async(contact) => {
        const _video = await Video.findOne({_id: video}).catch(err=>{
          console.log('err', err)
        })
        const currentUser = await User.findOne({_id: user}).catch(err=>{
          console.log('err', err)
        })
        const garbage = await Garbage.findOne({user: user}).catch(err=>{
          console.log('err', err)
        })
        
        const _activity = new Activity({
          content: 'LEAD CAPTURE - watched video',
          contacts: contact.id,
          user: currentUser.id,
          type: 'videos',
          videos: video,
          created_at: new Date(),
          updated_at: new Date(),
        })
        
        activity = await _activity.save().then().catch(err=>{
          console.log('err', err)
        })
        
        const created_at = moment().utcOffset(currentUser.time_zone).format('h:mm: a')
        const email_notification = garbage['email_notification']
        
        if(email_notification['lead_capture']){
          sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY); 
          const msg = {
              to: currentUser.email,
              from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
              templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
              dynamic_template_data: {
                subject: mail_contents.NOTIFICATION_WATCHED_VIDEO.SUBJECT,
                first_name: first_name,
                phone_number: `<a href="tel:${cell_phone}">${cell_phone}</a>`,
                email: `<a href="mailto:${email}">${email}</a>`,
                activity: first_name + ' watched lead capture video - <b>' + _video.title + '</b> at '+created_at,
                detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
              },
          };
          sgMail.send(msg).catch(err => console.error(err))
        }
        
        const desktop_notification = garbage['desktop_notification']
        if(desktop_notification['lead_capture']){
            webpush.setVapidDetails(
              'mailto:support@crmgrow.com',
              config.VAPID.PUBLIC_VAPID_KEY,
              config.VAPID.PRIVATE_VAPID_KEY
            )
            
            const subscription = JSON.parse(currentUser.desktop_notification_subscription)
            const title = contact.first_name + ' watched lead capture video'
            const created_at =moment().utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment().utcOffset(currentUser.time_zone).format('h:mm a')
            const body =contact.first_name  + ' - ' + contact.email + ' watched lead capture video: '+  _video.title + ' on ' + created_at
            const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico","badge": '/fav.ico'}})
            webpush.sendNotification(subscription, playload).catch(err => console.error(err))
        }
        
        const text_notification = garbage['text_notification']
        if(text_notification['lead_capture']){
          const e164Phone = phone(currentUser.cell_phone)[0]
        
          if (!e164Phone) {
            const error = {
              error: 'Invalid Phone Number'
            }
        
            throw error // Invalid phone number
          } else {
            let fromNumber = currentUser['proxy_number'];
            if(!fromNumber) {
              const areaCode = currentUser.cell_phone.substring(1, 4)
          
              const data = await twilio
              .availablePhoneNumbers('US')
              .local.list({
                areaCode: areaCode,
              })
            
              let number = data[0];
          
              if(typeof number == 'undefined'){
                const areaCode1 = currentUser.cell_phone.substring(1, 3)
          
                const data1 = await twilio
                .availablePhoneNumbers('US')
                .local.list({
                  areaCode: areaCode1,
                })
                number = data1[0];
              }
              
              if(typeof number != 'undefined'){
                const proxy_number = await twilio.incomingPhoneNumbers.create({
                  phoneNumber: number.phoneNumber,
                  smsUrl:  urls.SMS_RECEIVE_URL
                })
                
                console.log('proxy_number', proxy_number)
                currentUser['proxy_number'] = proxy_number.phoneNumber;
                fromNumber = currentUser['proxy_number'];
                currentUser.save().catch(err=>{
                  console.log('err', err)
                })
              } else {
                fromNumber = config.TWILIO.TWILIO_NUMBER
              } 
            }
          
            const title = contact.first_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n'+'\n'+ 'watched lead capture video: ' +'\n'+ _video.title + '\n'
            const created_at =moment().utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment().utcOffset(currentUser.time_zone).format('h:mm a')
            const time = ' on ' + created_at + '\n '
            const contact_link = urls.CONTACT_PAGE_URL + contact.id 
            twilio.messages.create({from: fromNumber, body: title+'\n'+time +contact_link,  to: e164Phone}).catch(err=>{
              console.log('send sms err: ',err)
            })
          } 
        } 
        
        Contact.update({_id: contact.id},{ $set: {last_activity: activity.id} }).catch(err=>{
          console.log('err', err)
        })
        
        return res.send({
          status: true,
          data:  {
            contact: contact.id,
            activity: activity.id
          }
        })
      }).catch(err => {
        return res.status(500).send({
          status: false,
          error: err.message
        })
      })
    } else if(pdf){
      _contact.save().then(async(contact) => {
        const _pdf = await PDF.findOne({_id: pdf}).catch(err=>{
          console.log('err', err)
        })
        const currentUser = await User.findOne({_id: user}).catch(err=>{
          console.log('err', err)
        })
        const garbage = await Garbage.findOne({user: user}).catch(err=>{
          console.log('err', err)
        })
        
        const _activity = new Activity({
          content: 'LEAD CAPTURE - watched pdf',
          contacts: contact.id,
          user: currentUser.id,
          type: 'pdfs',
          pdfs: pdf,
          created_at: new Date(),
          updated_at: new Date(),
        })
        
        activity = await _activity.save().then().catch(err=>{
          console.log('err', err)
        })
        
        const created_at = moment().utcOffset(currentUser.time_zone).format('h:mm: a')
        const email_notification = garbage['email_notification']
        
        if(email_notification['lead_capture']){
          sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY); 
          const msg = {
              to: currentUser.email,
              from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
              templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
              dynamic_template_data: {
                subject: mail_contents.NOTIFICATION_REVIEWED_PDF.SUBJECT,
                first_name: first_name,
                phone_number: `<a href="tel:${cell_phone}">${cell_phone}</a>`,
                email: `<a href="mailto:${email}">${email}</a>`,
                activity: first_name + ' watched lead capture pdf - <b>' + _pdf.title + '</b>at '+created_at,
                detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
              },
          };
          sgMail.send(msg).catch(err => console.error(err))
        }
        
        const desktop_notification = garbage['desktop_notification']
        if(desktop_notification['lead_capture']){
            webpush.setVapidDetails(
              'mailto:support@crmgrow.com',
              config.VAPID.PUBLIC_VAPID_KEY,
              config.VAPID.PRIVATE_VAPID_KEY
            )
            
            const subscription = JSON.parse(currentUser.desktop_notification_subscription)
            const title = contact.first_name + ' watched lead capture pdf'
            const created_at =moment().utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment().utcOffset(currentUser.time_zone).format('h:mm a')
            const body =contact.first_name  + ' - ' + contact.email + ' watched lead capture pdf: '+  _pdf.title + ' on ' + created_at
            const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico","badge": '/fav.ico'}})
            webpush.sendNotification(subscription, playload).catch(err => console.error(err))
        }
        
        const text_notification = garbage['text_notification']
        if(text_notification['lead_capture']){
          const e164Phone = phone(currentUser.cell_phone)[0]
        
          if (!e164Phone) {
            const error = {
              error: 'Invalid Phone Number'
            }
        
            throw error // Invalid phone number
          } else {
            let fromNumber = currentUser['proxy_number'];
            if(!fromNumber) {
              const areaCode = currentUser.cell_phone.substring(1, 4)
          
              const data = await twilio
              .availablePhoneNumbers('US')
              .local.list({
                areaCode: areaCode,
              })
            
              let number = data[0];
          
              if(typeof number == 'undefined'){
                const areaCode1 = currentUser.cell_phone.substring(1, 3)
          
                const data1 = await twilio
                .availablePhoneNumbers('US')
                .local.list({
                  areaCode: areaCode1,
                })
                number = data1[0];
              }
              
              if(typeof number != 'undefined'){
                const proxy_number = await twilio.incomingPhoneNumbers.create({
                  phoneNumber: number.phoneNumber,
                  smsUrl:  urls.SMS_RECEIVE_URL
                })
                
                console.log('proxy_number', proxy_number)
                currentUser['proxy_number'] = proxy_number.phoneNumber;
                fromNumber = currentUser['proxy_number'];
                currentUser.save().catch(err=>{
                  console.log('err', err)
                })
              } else {
                fromNumber = config.TWILIO.TWILIO_NUMBER
              } 
            }
          
            const title = contact.first_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n'+'\n'+ 'watched lead capture video: ' +'\n'+ _pdf.title + '\n'
            const created_at =moment().utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment().utcOffset(currentUser.time_zone).format('h:mm a')
            const time = ' on ' + created_at + '\n '
            const contact_link = urls.CONTACT_PAGE_URL + contact.id 
            twilio.messages.create({from: fromNumber, body: title+'\n'+time +contact_link,  to: e164Phone}).catch(err=>{
              console.log('send sms err: ',err)
            })
          } 
        } 
        
        Contact.update({_id: contact.id},{ $set: {last_activity: activity.id} }).catch(err=>{
          console.log('err', err)
        })
        
        return res.send({
          status: true,
          data:  {
            contact: contact.id,
            activity: activity.id
          }
        })
      }).catch(err => {
        return res.status(500).send({
          status: false,
          error: err.message
        })
      })
    }
  }  
}

isArray = function (a) {
  return (!!a) && (a.constructor === Array);
};
const advanceSearch = async (req, res) => {
  const { currentUser } = req;
  const { searchStr, 
    recruitingStageCondition, 
    labelCondition, 
    activityCondition, 
    activityStart, 
    activityEnd, 
    countryCondition, 
    regionCondition, 
    cityCondition, 
    zipcodeCondition, 
    tagsCondition, 
    brokerageCondition, 
    lastMaterial, 
    materialCondition, 
    sourceCondition,
    includeLabel,
    includeStage,
    includeSource,
    includeLastActivity,
    includeBrokerage } = req.body;

  // Material Check
  let watchedVideoContacts = [];
  let watchedPdfContacts = [];
  let watchedImageContacts = [];
  let notWatchedVideoContacts = [];
  let notWatchedPdfContacts = [];
  let notWatchedImageContacts = [];
  let notSentVideoContacts = [];
  let notSentPdfContacts = [];
  let notSentImageContacts = [];

  let excludeMaterialContacts = [];
  if (materialCondition['watched_video']['flag']) {
    let query = []
    if (materialCondition['watched_video']['material']) {
      query = [{ 'type': 'videos', 'videos': mongoose.Types.ObjectId(materialCondition['watched_video']['material']) }, { 'type': 'video_trackers', 'videos': mongoose.Types.ObjectId(materialCondition['watched_video']['material']) }]
    }
    else {
      query = [{ 'type': 'videos' }, { 'type': 'video_trackers' }]
    }
    watchedVideoContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $or: query }] }
      },
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts", type: "$type" },
          count: { $sum: 1 }
        }
      }, {
        $group: {
          _id: "$_id.contact",
          types: { $addToSet: { "action": "$_id.type" } }
        }
      },
      {
        $match: {
          "types": { "action": "video_trackers" }
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
  }
  if (materialCondition['watched_pdf']['flag']) {
    let query = []
    if (materialCondition['watched_pdf']['material']) {
      query = [{ 'type': 'pdfs', 'pdfs': mongoose.Types.ObjectId(materialCondition['watched_pdf']['material']) }, { 'type': 'pdf_trackers', 'pdfs': mongoose.Types.ObjectId(materialCondition['watched_pdf']['material']) }]
    }
    else {
      query = [{ 'type': 'pdfs' }, { 'type': 'pdf_trackers' }]
    }
    watchedPdfContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $or: query }] }
      },
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts", type: "$type" },
          count: { $sum: 1 }
        }
      }, {
        $group: {
          _id: "$_id.contact",
          types: { $addToSet: { "action": "$_id.type" } }
        }
      },
      {
        $match: {
          "types": { "action": "pdf_trackers" }
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
  }
  if (materialCondition['watched_image']['flag']) {
    let query = []
    if (materialCondition['watched_image']['material']) {
      query = [{ 'type': 'images', 'images': mongoose.Types.ObjectId(materialCondition['watched_image']['material']) }, { 'type': 'image_trackers', 'images': mongoose.Types.ObjectId(materialCondition['watched_image']['material']) }]
    }
    else {
      query = [{ 'type': 'images' }, { 'type': 'image_trackers' }]
    }
    watchedImageContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $or: query }] }
      },
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts", type: "$type" },
          count: { $sum: 1 }
        }
      }, {
        $group: {
          _id: "$_id.contact",
          types: { $addToSet: { "action": "$_id.type" } }
        }
      },
      {
        $match: {
          "types": { "action": "image_trackers" }
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
  }
  
  if (materialCondition['not_watched_video']['flag']) {
    let query = []
    if (materialCondition['not_watched_video']['material']) {
      query = [{ 'type': 'videos', 'videos': mongoose.Types.ObjectId(materialCondition['not_watched_video']['material']) }, { 'type': 'video_trackers', 'videos': mongoose.Types.ObjectId(materialCondition['not_watched_video']['material']) }]
    }
    else {
      query = [{ 'type': 'videos' }, { 'type': 'video_trackers' }]
    }
    notWatchedVideoContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $or: query }] }
      },
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts", type: "$type" },
          count: { $sum: 1 }
        }
      }, {
        $group: {
          _id: "$_id.contact",
          types: { $addToSet: { "action": "$_id.type" } }
        }
      },
      {
        $match: {
          $nor: [{ "types": { "action": "video_trackers" } }]
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
  }
  if (materialCondition['not_watched_pdf']['flag']) {
    let query = []
    if (materialCondition['not_watched_pdf']['material']) {
      query = [{ 'type': 'pdfs', 'pdfs': mongoose.Types.ObjectId(materialCondition['not_watched_pdf']['material']) }, { 'type': 'pdf_trackers', 'pdfs': mongoose.Types.ObjectId(materialCondition['not_watched_pdf']['material']) }]
    }
    else {
      query = [{ 'type': 'pdfs' }, { 'type': 'pdf_trackers' }]
    }
    notWatchedPdfContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $or: query }] }
      },
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts", type: "$type" },
          count: { $sum: 1 }
        }
      }, {
        $group: {
          _id: "$_id.contact",
          types: { $addToSet: { "action": "$_id.type" } }
        }
      },
      {
        $match: {
          $nor: [{ "types": { "action": "pdf_trackers" } }]
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
  }
  if (materialCondition['not_watched_image']['flag']) {
    let query = []
    if (materialCondition['not_watched_image']['material']) {
      query = [{ 'type': 'images', 'images': mongoose.Types.ObjectId(materialCondition['not_watched_image']['material']) }, { 'type': 'image_trackers', 'images': mongoose.Types.ObjectId(materialCondition['not_watched_image']['material']) }]
    }
    else {
      query = [{ 'type': 'images' }, { 'type': 'image_trackers' }]
    }
    notWatchedImageContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $or: query }] }
      },
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts", type: "$type" },
          count: { $sum: 1 }
        }
      }, {
        $group: {
          _id: "$_id.contact",
          types: { $addToSet: { "action": "$_id.type" } }
        }
      },
      {
        $match: {
          $nor: [{ "types": { "action": "image_trackers" } }]
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
  }

  if (materialCondition['not_sent_video']['flag']) {
    let query = []
    if (materialCondition['not_sent_video']['material']) {
      query = [{ 'type': 'videos', 'videos': mongoose.Types.ObjectId(materialCondition['not_sent_video']['material']) }]
    }
    else {
      query = [{ 'type': 'videos' }]
    }
    notSentVideoContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $and: query }] }
      },            
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts"},
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.contact"
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
    notSentVideoContacts.forEach(e => {
      if(excludeMaterialContacts.indexOf(e._id)==-1) {
        e._id && excludeMaterialContacts.push(mongoose.Types.ObjectId(e._id));
      }
    });
  }
  if (materialCondition['not_sent_pdf']['flag']) {
    let query = []
    if (materialCondition['not_sent_pdf']['material']) {
      query = [{ 'type': 'pdfs', 'pdfs': mongoose.Types.ObjectId(materialCondition['not_sent_pdf']['material']) }]
    }
    else {
      query = [{ 'type': 'pdfs' }]
    }
    notSentPdfContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $and: query }] }
      },      
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts"},
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.contact"
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
    notSentPdfContacts.forEach(e => {
      if(excludeMaterialContacts.indexOf(e._id)==-1) {
        e._id && excludeMaterialContacts.push(mongoose.Types.ObjectId(e._id));
      }
    })
    
  }
  if (materialCondition['not_sent_image']['flag']) {
    let query = []
    if (materialCondition['not_sent_image']['material']) {
      query = [{ 'type': 'images', 'images': mongoose.Types.ObjectId(materialCondition['not_sent_image']['material']) }]
    }
    else {
      query = [{ 'type': 'images' }]
    }
    notSentImageContacts = await Activity.aggregate([
      {
        $match: { $and: [{ "user": mongoose.Types.ObjectId(currentUser._id) }, { $and: query }] }
      },
      {$unwind: '$contacts'},
      {
        $group: {
          _id: { contact: "$contacts"},
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.contact"
        }
      },
      {
        $project: { "_id": 1 }
      }
    ]);
    notSentImageContacts.forEach(e => {
      if(excludeMaterialContacts.indexOf(e._id)==-1) {
        e._id && excludeMaterialContacts.push(mongoose.Types.ObjectId(e._id));
      }
    })
  }
  let materialContacts = [];
  watchedVideoContacts.forEach(e => {
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  watchedPdfContacts.forEach(e => {
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  watchedImageContacts.forEach(e => {
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  notWatchedVideoContacts.forEach(e => {
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  notWatchedPdfContacts.forEach(e => {
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  notWatchedImageContacts.forEach(e => {
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  var query = { $and: [{ user: mongoose.Types.ObjectId(currentUser.id) }] };

  let includeMaterialCondition = (materialCondition['not_watched_pdf']['flag'] || 
                                    materialCondition['not_watched_video']['flag'] || 
                                    materialCondition['watched_pdf']['flag'] || 
                                    materialCondition['watched_video']['flag'] || 
                                    materialCondition['watched_image']['flag'] || 
                                    materialCondition['not_watched_image']['flag']);
  let excludeMaterialCondition = (materialCondition['not_sent_video']['flag'] || materialCondition['not_sent_pdf']['flag'] || materialCondition['not_sent_image']['flag'])

  if (materialContacts.length) {
    // Exclude Contacts from material contacts
    let materialQuery = { '_id': { $in: materialContacts } };
    if(excludeMaterialCondition) {
      if( excludeMaterialContacts.length ) {
        materialQuery = {$or: [ { '_id': { $in: materialContacts } }, {'_id': {$nin: excludeMaterialContacts}}]}
      }
    }    
    query['$and'].push(materialQuery);
  }
  else {    
    if( includeMaterialCondition ) {
      if( excludeMaterialContacts.length ) {
        query['$and'].push({ '_id': { $nin: excludeMaterialContacts } })
      }
      else if(!excludeMaterialCondition){
        return res.send({
          status: true,
          data: []
        });
      }
    }
    else {
      if( excludeMaterialContacts ) {
        query['$and'].push({ '_id': { $nin: excludeMaterialContacts } })
      }
    }
  }
  
  if (searchStr) {
    var strQuery = {};
    if (!searchStr.split(" ")[1]) {
      strQuery = {
        $or: [
          { first_name: { '$regex': '.*' + searchStr + ".*", '$options': 'i' } },
          { email: { '$regex': '.*' + searchStr + '.*', '$options': 'i' } },
          { last_name: { '$regex': '.*' + searchStr + ".*", '$options': 'i' } },
          { cell_phone: { '$regex': '.*' + searchStr + ".*", '$options': 'i' } }
        ]
      }
    }
    else {
      let firstStr = searchStr.split(" ")[0];
      let secondStr = searchStr.split(" ")[1];
      strQuery = {
        $or: [
          { first_name: { '$regex': '.*' + firstStr, '$options': 'i' }, last_name: { '$regex': secondStr + ".*", '$options': 'i' } },
          { first_name: { '$regex': '.*' + searchStr + ".*", '$options': 'i' } },
          { last_name: { '$regex': '.*' + searchStr + ".*", '$options': 'i' } },
          { cell_phone: { '$regex': '.*' + searchStr + ".*", '$options': 'i' } }
        ]
      }
    }
    query['$and'].push(strQuery);
  }

  if (recruitingStageCondition && recruitingStageCondition.length) {
    if(recruitingStageCondition.indexOf(false) !==-1 ) {
      var stageQuery = { $or : [{recruiting_stage: { $in: recruitingStageCondition}}, {recruiting_stage: ''}, {recruiting_stage: undefined}] };
      query['$and'].push(stageQuery)
    }
    else{
      var stageQuery = {};
      if(includeStage) {
        stageQuery = { recruiting_stage: { $in: recruitingStageCondition } };
      }
      else {
        stageQuery = { recruiting_stage: { $nin: recruitingStageCondition } };
      }
      query['$and'].push(stageQuery);
    }    
  }
  if(sourceCondition && sourceCondition.length) {
    if(sourceCondition.indexOf(false) !==-1 ) {
      var sourceQuery = { $or : [{source: { $in: sourceCondition}}, {source: ''}, {source: undefined}] };
      query['$and'].push(sourceQuery)
    }
    else {
      var sourceQuery = {};
      if(includeSource) {
        sourceQuery = { source: { $in: sourceCondition } };
      }
      else {
        sourceQuery = { source: { $nin: sourceCondition } };
      }      
      query['$and'].push(sourceQuery);
    }    
  }
  if (labelCondition && labelCondition.length) {
    if(labelCondition.indexOf('') !== -1){
      labelCondition.push(undefined);
    }
    var labelQuery
    if(includeLabel) {
      labelQuery = { label: { $in: labelCondition } };
    }
    else {
      labelQuery = { label: { $nin: labelCondition } };
    }
    
    labelQuery = query['$and'].push(labelQuery);
  }
  if (tagsCondition && tagsCondition.length) {
    if(tagsCondition.indexOf(false) !==-1 ) {
      tagsCondition.splice(tagsCondition.indexOf(false), 1);
      var tagsQuery = { $or : [{ tags: { $elemMatch: { $in: tagsCondition } } }, {tags: []}, {tags: undefined}] };
      query['$and'].push(tagsQuery)
    }
    else {
      var tagsQuery = { tags: { $elemMatch: { $in: tagsCondition } } };
      query['$and'].push(tagsQuery);
    }    
  }
  if (brokerageCondition && brokerageCondition.length) {
    if(brokerageCondition.indexOf(false) !==-1 ) {
      var brokerageQuery = { $or : [{brokerage: { $in: brokerageCondition}}, {brokerage: ''}, {brokerage: undefined}] };
      query['$and'].push(brokerageQuery)
    }
    else {
      var brokerageQuery;
      if(includeBrokerage) {
        brokerageQuery = { brokerage: { $in: brokerageCondition } };
      }
      else {
        brokerageQuery = { brokerage: { $nin: brokerageCondition } };
      }
      
      query['$and'].push(brokerageQuery)
    }    
  }
  if (countryCondition) {
    var countryQuery = { country: countryCondition };
    query['$and'].push(countryQuery)
  }
  if (regionCondition && regionCondition.length) {
    var regionQuery = { state: {$in: regionCondition} };
    query['$and'].push(regionQuery)
  }
  if (cityCondition) {
    var cityQuery = { city: { '$regex': ".*" + cityCondition + ".*" } };
    query['$and'].push(cityQuery)
  }
  if (zipcodeCondition) {
    var zipQuery = { zip: { '$regex': ".*" + zipcodeCondition + ".*" } }
    query['$and'].push(zipQuery)
  }

  // Activity Time Query 
  var contacts = await Contact.find(query).populate({path: 'last_activity'}).sort({ first_name: 1 }).catch(err => {
    console.log('err', err)
  })

  let results = [];
  let resultContactIds = [];
  if ((activityCondition && activityCondition.length) || activityStart || activityEnd || lastMaterial['send_video']['flag'] || lastMaterial['send_pdf']['flag'] || lastMaterial['send_image']['flag'] || lastMaterial['watched_video']['flag'] || lastMaterial['watched_pdf']['flag'] || lastMaterial['watched_image']['flag']) {
    contacts.forEach(e => {
      let activity = e.last_activity;
      if(!activity) {return;}
      if(activityStart || activityEnd) {
        if(activityStart) {
          if (new Date(activity.created_at) < new Date(activityStart)) {
            return;
          }
        }
        if(activityEnd) {
          if (new Date(activity.created_at) > new Date(activityEnd)) {
            return;
          }
        }
        if(!(lastMaterial['send_video']['flag'] || lastMaterial['send_pdf']['flag'] || lastMaterial['send_image']['flag'] || lastMaterial['watched_video']['flag'] || lastMaterial['watched_pdf']['flag'] || lastMaterial['watched_image']['flag']) && !activityCondition.length) {
          results.push(e);
          resultContactIds.push(e._id);
          return;
        }
      }
      if (lastMaterial['send_video']['flag']) {
        if (lastMaterial['send_video']['material']) {
          if (activity.type == 'videos' && activity.videos == lastMaterial['send_video']['material']) {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
        else {
          if (activity.type == 'videos') {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
      }
      if (lastMaterial['send_pdf']['flag']) {
        if (lastMaterial['send_pdf']['material']) {
          if (activity.type == 'pdfs' && activity.pdfs == lastMaterial['send_pdf']['material']) {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
        else {
          if (activity.type == 'pdfs') {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
      }
      if (lastMaterial['send_image']['flag']) {
        if (lastMaterial['send_image']['material']) {
          if (activity.type == 'images' && activity.images == lastMaterial['send_image']['material']) {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
        else {
          if (activity.type == 'images') {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
      }
      if (lastMaterial['watched_video']['flag']) {
        if (lastMaterial['watched_video']['material']) {
          if (activity.type == 'video_trackers' && activity.videos == lastMaterial['watched_video']['material']) {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
        else {
          if (activity.type == 'video_trackers') {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
      }
      if (lastMaterial['watched_pdf']['flag']) {
        if (lastMaterial['watched_pdf']['material']) {
          if (activity.type == 'pdf_trackers' && activity.pdfs == lastMaterial['watched_pdf']['material']) {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
        else {
          if (activity.type == 'pdf_trackers') {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
      }
      if (lastMaterial['watched_image']['flag']) {
        if (lastMaterial['watched_image']['material']) {
          if (activity.type == 'image_trackers' && activity.pdfs == lastMaterial['watched_image']['material']) {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
        else {
          if (activity.type == 'image_trackers') {
            results.push(e);
            resultContactIds.push(e._id);
            return;
          }
        }
      }
      if (activityCondition.length) {
        if (activityCondition.indexOf(activity.type) !== -1) {
          results.push(e)
          resultContactIds.push(e._id);
          return;
        }
      }
    })
    if(!includeLastActivity) {
      results = []
      contacts.forEach(e => {
        if(resultContactIds.indexOf(e._id) === -1) {
          results.push(e)
        }
      })
    }
  }
  else {
    results = contacts;
  }
  
  const count = await Contact.countDocuments({ user: currentUser.id })

  return res.send({
    status: true,
    data: results,
    total: count
  });
}

const getBrokerages = async (req, res) => {
  const { currentUser } = req

  data = await Contact.aggregate(
    [
      {
        $match: { user: mongoose.Types.ObjectId(currentUser.id) }
      },
      { $group: { "_id": "$brokerage" } },
      {
        $sort: { "_id": 1 } 
      }
    ]
  ).catch(err => {
    console.log('err', err)
  });

  return res.send({
    status: true,
    data
  })
}

const getSources = async (req, res) => {
  const { currentUser } = req

  data = await Contact.aggregate(
    [
      {
        $match: { user: mongoose.Types.ObjectId(currentUser.id) }
      },
      { $group: { "_id": "$source" } },
      {
        $sort: {"_id": 1}
      }
    ]
  ).catch(err => {
    console.log('err', err)
  });

  return res.send({
    status: true,
    data
  })
}

const getNthContact = async (req, res) => {
  const { currentUser } = req
  const skip = req.params.id;

  contact = await Contact.aggregate([
    {
      $match: { user: currentUser.id}
    },
    {
      $sort: { "first_name": 1 } 
    },
    {
      $skip: skip
    }
  ])
}

const loadFollows = async (req, res) => {
  const {currentUser} = req;
  const {contact} = req.body;

  const _follow_up = await FollowUp.find({ user: currentUser.id, contact: contact, status: {$ne: -1}}).sort({ due_date: 1 })
  return res.send({
    status: true,
    follow_ups: _follow_up
  })
}

const loadTimelines = async (req, res) => {
  const {currentUser} = req;
  const {contact} = req.body;

  const _timelines = await TimeLine.find({ user: currentUser.id, contact: contact})
  return res.send({
    status: true,
    timelines: _timelines
  })
}

const selectAllContacts = async (req, res) => {
  const {currentUser} = req;
  
  const contacts = await Contact.find({user: currentUser.id}).select('_id');
  return res.send({
    status: true,
    data: contacts
  })
}

module.exports = {
  getAll,
  getAllByLastActivity,
  getByLastActivity,
  get,
  getBrokerages,
  getSources,
  create,
  search,
  advanceSearch,
  searchEasy,
  remove,
  removeContacts,
  edit,
  bulkEditLabel,
  bulkUpdate,
  receiveEmail,
  importCSV,
  exportCSV,
  getById,
  getByIds,
  getNthContact,
  leadContact,
  loadFollows,
  loadTimelines,
  selectAllContacts
}