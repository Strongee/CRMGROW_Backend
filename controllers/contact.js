const { validationResult } = require('express-validator/check')
const mongoose = require('mongoose')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Appointment = require('../models/appointment')
const Email = require('../models/email')
const Note = require('../models/note')
const User = require('../models/user')
const EmailTracker = require('../models/email_tracker')
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
    contacts = await Contact.find({ user: currentUser.id }).populate('last_activity').sort({ first_name: 1 }).limit(15)
  } else {
    const id = parseInt(req.params.id)
    contacts = await Contact.find({ user: currentUser.id }).populate('last_activity').sort({ first_name: 1 }).skip(id).limit(15)
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

  const _follow_up = await FollowUp.find({ user: currentUser.id, contact: req.params.id }).sort({ due_date: 1 })
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
      { "prev": prev}
    );

  res.send({
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
        content: currentUser.user_name + ' added contact',
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

  res.send({
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
  Contact.find({ _id: { $in: contacts } }).update({ $set: { label: label } }).then(() => {
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
  const { contacts, data} = req.body;
  Contact.find({_id: {$in: contacts}}).updateMany({$set: data}).then(() => {
    res.send({
      status: true
    })
  }).catch(err => {
    res.status(500).send({
      status: false,
      error: err.message || 'Update Error'
    })
  })
}

const sendBatch = async (req, res) => {
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const { currentUser } = req
  let { cc, bcc, to, subject, content, contacts } = req.body

  if (typeof subject == 'undefined' || subject == "") {
    return res.status(400).send({
      status: false,
      error: 'Subject email must be specified'
    })
  }
  
  for (let i = 0; i < contacts.length; i++) {  
    const _contact = await Contact.findOne({_id: contacts[i]})
    subject = subject.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
    content = content.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
    
    const msg = {
      from: `${currentUser.user_name} <${currentUser.email}>`,
      subject: subject,
      to: to[i],
      cc: cc,
      bcc: bcc,
      text: content,
      html: '<html><head><title>Email</title></head><body><p>' + content + '</p><br/><br/>' + currentUser.email_signature + '</body></html>',
    };
    sgMail.send(msg).then(async(_res) => {     
      console.log('mailres.errorcode', _res[0].statusCode);
      if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){  
        console.log('message_id*******************', _res[0].headers['x-message-id'])
        console.log('Successful send to '+msg.to)
        const email = new Email({
          ...req.body,
          contact: contacts[i],
          message_id: _res[0].headers['x-message-id'],
          user: currentUser.id,
          updated_at: new Date(),
          created_at: new Date()
        })
        
        const _email = await email.save().then().catch(err => {
          console.log('err', err)
        })
        
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
          Contact.findByIdAndUpdate(contacts[i], { $set: { last_activity: _activity.id } }).catch(err => {
          console.log('err', err)
        })
      }else {
        console.log('email sending err', msg.to+_res[0].statusCode)
      }
    }).catch(err => {
      console.log('err', err)
    })
  }
  return res.send({
    status: true,
  })
}

const sendEmail = async (req, res) => {
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)

  const { currentUser } = req
  const { contact, content, attachments } = req.body
  const _contact = await Contact.findOne({ _id: contact })
  const msg = {
    from: currentUser.email,
    to: _contact.email,
    subject: currentUser.user_name + ' sent email',
    attachments: attachments,
    html: content + '<br/><br/>' + currentUser.email_signature
  };

  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
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
            Contact.findByIdAndUpdate(_contact.id, { $set: { last_activity: _activity.id } }).catch(err => {
              console.log('err', err)
            })
            myJSON = JSON.stringify(_email)
            const data = JSON.parse(myJSON);
            data.activity = _activity
            res.send({
              status: true,
              data
            })
          })
        })
    } else {
      return res.status(404).send({
        status: false,
        error: _res[0].statusCode
      })
    }
  }).catch((e) => {
    console.error(e)
    return res.status(500).send({
      status: false,
      error: 'internal_server_error'
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
      
      let opened = new Date(time_stamp*1000);
      const created_at = moment(opened).utcOffset(user.time_zone).format('h:mm a')
      let action = ''
      if(event == 'open'){
        action = 'opened'
        const email_activity = await Activity.findOne({contacts: contact.id, emails: _email.id}).catch(err=>{
          console.log('err', err)
        })
        
        let reopened = new Date(time_stamp*1000-5*60*1000)
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
            content: contact.first_name + ' opened email',
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
        } else {
          return;
        }
      }
      if(event == 'click'){
        action = 'clicked'
        const email_activity = await Activity.findOne({contacts: contact.id, emails: _email.id}).catch(err=>{
          console.log('err', err)
        })
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
          content: contact.first_name + ' clicked email',
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
          content: contact.first_name + ' unsubscribed email',
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
    console.log('here')
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY); 
    const msg = {
        to: user.email,
        from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
        subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
        templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
        dynamic_template_data: {
          first_name: contact.first_name,
          last_name: contact.last_name,
          phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
          email: `<a href="mailto:${email}">${email}</a>`,
          activity: contact.first_name + ' '+action+' email: '+ _email.subject + ' at ' + created_at,
          detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
        },
    };
    sgMail.send(msg).catch(err => console.error(err)) 
    if(user.desktop_notification){
        webpush.setVapidDetails(
          'mailto:support@crmgrow.com',
          config.VAPID.PUBLIC_VAPID_KEY,
          config.VAPID.PRIVATE_VAPID_KEY
        )
        
        const subscription = JSON.parse(user.desktop_notification_subscription)
        const title = contact.first_name + ' ' + contact.last_name + ' - ' + contact.email + ' ' + action + ' email' 
        const created_at =moment(opened).utcOffset(user.time_zone).format('DD/MM/YYYY') + ' at ' + moment(opened).utcOffset(user.time_zone).format('h:mm a')
        const body =contact.first_name  + ' ' + contact.last_name + ' - ' + contact.email + ' ' + action + ' email: '+_email.subject+' on ' + created_at
        const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico","badge": '/fav.ico'}})
        webpush.sendNotification(subscription, playload).catch(err => console.error(err))
    }  
    if(user.text_notification){
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
        const created_at =moment(opened).utcOffset(user.time_zone).format('DD/MM/YYYY') + ' at ' + moment(opened).utcOffset(user.time_zone).format('h:mm a')
        const time = ' on ' + created_at + '\n '
        const contact_link = urls.CONTACT_PAGE_URL + contact.id 
        twilio.messages.create({from: fromNumber, body: title+'\n'+time +contact_link,  to: e164Phone}).catch(err=>{
          console.log('send sms err: ',err)
        })
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
                content: currentUser.user_name + ' added contact',
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
                    content: currentUser.user_name + ' added note',
                    contacts: _contact.id,
                    user: currentUser.id,
                    type: 'notes',
                    notes: _note.id,
                    created_at: new Date(),
                    updated_at: new Date(),
                  })
                  _activity.save().then((__activity) => {
                    Contact.findByIdAndUpdate(_contact.id, { $set: { last_activity: __activity.id } }).catch(err => {
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

  return res.send({
    status: true,
    data: {
      contacts,
      search: search
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
  let notWatchedVideoContacts = [];
  let notWatchedPdfContacts = [];
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

  let materialContacts = [];
  watchedVideoContacts.forEach(e => {
    if (e._id && isArray(e._id)) {
      materialContacts.push(mongoose.Types.ObjectId(e._id[0]));
      return;
    }
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  watchedPdfContacts.forEach(e => {
    if (e._id && isArray(e._id)) {
      materialContacts.push(mongoose.Types.ObjectId(e._id[0]));
      return;
    }
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  notWatchedVideoContacts.forEach(e => {
    if (e._id && isArray(e._id)) {
      materialContacts.push(mongoose.Types.ObjectId(e._id[0]));
      return;
    }
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })
  notWatchedPdfContacts.forEach(e => {
    if (e._id && isArray(e._id)) {
      materialContacts.push(mongoose.Types.ObjectId(e._id[0]));
      return;
    }
    e._id && materialContacts.push(mongoose.Types.ObjectId(e._id));
  })

  var query = { $and: [{ user: mongoose.Types.ObjectId(currentUser.id) }] };

  if (materialContacts.length) {
    let materialQuery = { '_id': { $in: materialContacts } };
    query['$and'].push(materialQuery);
  }
  else {
    if(materialCondition['not_watched_pdf']['flag'] || materialCondition['not_watched_video']['flag'] || materialCondition['watched_pdf']['flag'] || materialCondition['watched_video']['flag']) {
      return res.send({
        status: true,
        data: []
      });
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
        sourceQuery = { source: { $nin: sourceCondition } };
      }
      else {
        sourceQuery = { source: { $in: sourceCondition } };
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

  // let results = [];
  // if ((activityCondition && activityCondition.length) || activityStart || activityEnd || lastMaterial['send_video']['flag'] || lastMaterial['send_pdf']['flag'] || lastMaterial['watched_video']['flag'] || lastMaterial['watched_pdf']['flag']) {
  //   contacts.forEach(e => {
  //     let activity = e.last_activity;
  //     if (lastMaterial['send_video']['flag'] || lastMaterial['send_pdf']['flag'] || lastMaterial['watched_video']['flag'] || lastMaterial['watched_pdf']['flag']) {
  //       if (lastMaterial['send_video']['flag']) {
  //         if (lastMaterial['send_video']['material']) {
  //           if (activity.type == 'videos' && activity.videos == lastMaterial['send_video']['material']) {
  //             results.push(e);
  //             return;
  //           }
  //         }
  //         else {
  //           if (activity.type == 'videos') {
  //             results.push(e);
  //             return;
  //           }
  //         }
  //       }
  //       if (lastMaterial['send_pdf']['flag']) {
  //         if (lastMaterial['send_pdf']['material']) {
  //           if (activity.type == 'pdfs' && activity.videos == lastMaterial['send_pdf']['material']) {
  //             results.push(e);
  //             return;
  //           }
  //         }
  //         else {
  //           if (activity.type == 'pdfs') {
  //             results.push(e);
  //             return;
  //           }
  //         }
  //       }
  //       if (lastMaterial['watched_video']['flag']) {
  //         if (lastMaterial['watched_video']['material']) {
  //           if (activity.type == 'video_trackers' && activity.videos == lastMaterial['watched_video']['material']) {
  //             results.push(e);
  //             return;
  //           }
  //         }
  //         else {
  //           if (activity.type == 'video_trackers') {
  //             results.push(e); 
  //             return;
  //           }
  //         }
  //       }
  //       if (lastMaterial['watched_pdf']['flag']) {
  //         if (lastMaterial['watched_pdf']['material']) {
  //           if (activity.type == 'pdf_trackers' && activity.videos == lastMaterial['watched_pdf']['material']) {
  //             results.push(e);
  //             return;
  //           }
  //         }
  //         else {
  //           if (activity.type == 'pdf_trackers') {
  //             results.push(e);
  //             return;
  //           }
  //         }
  //       }
  //     }
  //     if (!activityCondition.length && !activityStart && !activityEnd) {
  //       return;
  //     }
  //     if (activityCondition.length) {
  //       if (activityCondition.indexOf(e.last_activity.type) === -1) {
  //         return;
  //       }
  //     }
  //     if (activityStart) {
  //       if (new Date(e.last_activity.created_at) < new Date(activityStart)) {
  //         return;
  //       }
  //     }
  //     if (activityEnd) {
  //       if (new Date(e.last_activity.created_at) > new Date(activityEnd)) {
  //         return;
  //       }
  //     }
  //     results.push(e);
  //   })
  // }
  // else {
  //   results = contacts;
  // }
  let lastActivityQueries = {};
  if ((activityCondition && activityCondition.length) || activityStart || activityEnd || lastMaterial['send_video']['flag'] || lastMaterial['send_pdf']['flag'] || lastMaterial['watched_video']['flag'] || lastMaterial['watched_pdf']['flag']) {
    let activityQueries = {};
    let lastActivityQuery;
    // last activity condition
    if(activityCondition && activityCondition.length) {
      if(includeLastActivity) {
        lastActivityQuery = {type: {$in: activityCondition}};
        activityQueries['$or'] = [lastActivityQuery];
      }
      else {
        lastActivityQuery = {type: {$nin: activityCondition}};
        activityQueries['$and'] = [lastActivityQuery];
      }
      
    }
    // last material activity condition
    let lastSendVideoQuery;
    let lastSendPdfQuery;
    let lastWatchedVideoQuery;
    let lastWatchedPdfQuery;
    // sent video query
    if(lastMaterial['send_video']['flag'])  {
      if(includeLastActivity) {
        lastSendVideoQuery = {type: 'videos'}
        if(lastMaterial['send_video']['material']) {
          lastSendVideoQuery['videos'] = lastMaterial['send_video']['material'];
        }
        if(activityQueries['$or']) {activityQueries['$or'].push(lastSendVideoQuery)}
        else {activityQueries['$or'] = [lastSendVideoQuery]}
      }
      else {
        lastSendVideoQuery = {type: { $ne: 'videos'}}
        if(lastMaterial['send_video']['material']) {
          lastSendVideoQuery['videos'] = {$ne : lastMaterial['send_video']['material']};
        }
        if(activityQueries['$and']) {activityQueries['$and'].push(lastSendVideoQuery)}
        else {activityQueries['$and'] = [lastSendVideoQuery]}
      }
    }
    // sent pdf query
    if(lastMaterial['send_pdf']['flag'])  {
      if(includeLastActivity) {
        lastSendPdfQuery = {type: 'pdfs'}
        if(lastMaterial['send_pdf']['material']) {
          lastSendPdfQuery['pdfs'] = lastMaterial['send_pdf']['material'];
        }
        if(activityQueries['$or']) {activityQueries['$or'].push(lastSendPdfQuery)}
        else {activityQueries['$or'] = [lastSendPdfQuery]}  
      }
      else {
        lastSendPdfQuery = {type: { $ne: 'pdfs'}}
        if(lastMaterial['send_pdf']['material']) {
          lastSendPdfQuery['pdfs'] = {$ne : lastMaterial['send_pdf']['material']};
        }
        if(activityQueries['$and']) {activityQueries['$and'].push(lastSendPdfQuery)}
        else {activityQueries['$and'] = [lastSendPdfQuery]}
      }
    }
    // watched video query
    if(lastMaterial['watched_video']['flag'])  {
      if(includeLastActivity) {
        lastWatchedVideoQuery = { type: 'video_trackers'};
        if(lastMaterial['watched_video']['material']) {
          lastWatchedVideoQuery['videos'] = lastMaterial['watched_video']['material'];
        }
        if(activityQueries['$or']) {activityQueries['$or'].push(lastWatchedVideoQuery)}
        else {activityQueries['$or'] = [lastWatchedVideoQuery]} 
      }
      else {
        lastWatchedVideoQuery = { type: {$ne: 'video_trackers'}};
        if(lastMaterial['watched_video']['material']) {
          lastWatchedVideoQuery['videos'] = {$ne: lastMaterial['watched_video']['material']};
        }
        if(activityQueries['$and']) {activityQueries['$and'].push(lastWatchedVideoQuery)}
        else {activityQueries['$and'] = [lastWatchedVideoQuery]}
      }
      
    }
    // watched pdf query
    if(lastMaterial['watched_pdf']['flag'])  {
      if(includeLastActivity) {
        lastWatchedPdfQuery = { type: 'pdf_trackers'};
        if(lastMaterial['watched_pdf']['material']) {
          lastWatchedPdfQuery['pdfs'] = lastMaterial['watched_pdf']['material'];
        }
        if(activityQueries['$or']) {activityQueries['$or'].push(lastWatchedPdfQuery)}
        else {activityQueries['$or'] = [lastWatchedPdfQuery]} 
      }
      else {
        lastWatchedPdfQuery = { type: {$ne: 'pdf_trackers'}};
        if(lastMaterial['watched_pdf']['material']) {
          lastWatchedPdfQuery['pdfs'] = {$ne: lastMaterial['watched_pdf']['material']};
        }
        if(activityQueries['$and']) {activityQueries['$and'].push(lastWatchedPdfQuery)}
        else {activityQueries['$and'] = [lastWatchedPdfQuery]} 
      }      
    }
    // last activity time
    let timeQuery;
    if(activityStart && activityEnd) {
      timeQuery = {created_at : {$gte: activityStart, $lte: activityEnd}};
    }
    else if(activityStart) {
      timeQuery = {created_at : {$gte: activityStart}};
    }
    else if(activityEnd) {
      timeQuery = {created_at : {$lte: activityStart}};
    }
    lastActivityQueries['$and'] = [activityQueries];
    if(timeQuery) {
      lastActivityQueries['$and'].push(timeQuery);
    }
  }
  var contacts = await Contact.find(query).populate({path: 'last_activity', match:lastActivityQueries}).sort({ first_name: 1 }).catch(err => {
    console.log('err', err)
  })
  results = contacts;

  return res.send({
    status: true,
    data: results
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
  sendBatch,
  sendEmail,
  receiveEmail,
  importCSV,
  exportCSV,
  getById,
  getByIds,
  getSources,
  getNthContact
}