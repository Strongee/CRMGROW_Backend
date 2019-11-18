const phone = require('phone')
const User = require('../models/user')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const SMS = require('../models/sms')
const urls = require('../constants/urls')
const config = require('../config/config')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN

const twilio = require('twilio')(accountSid, authToken)

const send = async(req, res) => {

  const { currentUser } = req
  const {text} = req.body
  const contact = await Contact.findOne({_id: req.params.id})
  const e164Phone = phone(contact.cell_phone)[0]
  const fromNumber = currentUser.twilio_proxy_number
  console.info(`Send SMS: ${fromNumber} -> ${contact.cell_phone} :`, text)

  if (!e164Phone) {
    const error = {
      error: 'Invalid Phone Number'
    }

    throw error // Invalid phone number
  }

    await twilio.messages.create({from: fromNumber, body: text, to: e164Phone})

    const sms = new SMS({
        content: req.body.text,
        contact: req.params.id,
        to: e164Phone,
        from: fromNumber,
        user: currentUser.id,
        updated_at: new Date(),
        created_at: new Date(),
      })

      sms.save()
      .then(_sms => {
    
        const activity = new Activity({
          content: currentUser.user_name + ' sent text',
          contacts: _sms.contact,
          user: currentUser.id,
          type: 'sms',
          sms: _sms.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
    
        activity.save().then(_activity => {
          myJSON = JSON.stringify(_sms)
          const data = JSON.parse(myJSON);
          data.activity = _activity
          res.send({
            status: true,
            data
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

const receive = async(req, res) => {
    const text = req.body['Body']
    const from = req.body['From']
    const to = req.body['To']

    let currentUser = await User.findOne({proxy_number: to})
    if(currentUser != null){
      const phoneNumberString = req.body['From']
      const cleaned = ('' + phoneNumberString).replace(/\D/g, '')
      const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
      const phoneNumber = '(' + match[2] + ') ' + match[3] + '-' + match[4]
      const contact = await Contact.findOne({cell_phone: phoneNumber}).catch(err=>{
        console.log('err', err)
      })
      const e164Phone = phone(currentUser.cell_phone)[0]
      const content =  "Replies from" +  '\n' + contact.first_name + contact.last_name +  '\n' + contact.cell_phone + '\n' + contact.email + '\n' + '\n' + text
      await twilio.messages.create({from: to, body: content, to: e164Phone}).catch(err=>{
        console.log('err', err)
      })
      const sms = new SMS({
        content: text,
        contact: contact.id,  
        to: currentUser.cell_phone,
        from: from,
        user: currentUser.id,
        updated_at: new Date(),
        created_at: new Date(),
      })
  
      const _sms = await sms.save()
        
      const activity = new Activity({
        content: contact.first_name + ' replied text',
        contacts: contact.id,
        user: currentUser.id,
        type: 'sms',
        sms: _sms.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      
      activity.save()
      res.send({
        status: true,
      })
    }  
}

const get = async(req, res) => {
  const { currentUser } = req
  const query = {...req.query}
  const contact = query['contact']
  const data = await Note.find({user :currentUser.id, contact: contact});
  
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
    get,
    send,
    receive,
}