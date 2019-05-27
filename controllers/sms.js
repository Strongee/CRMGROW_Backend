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
const parsePhoneNumberFromString = require('libphonenumber-js') 

const send = async(req, res) => {
  console.log('test_send')
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

    console.log('test_receive')
    let currentUser = await User.findOne({twilio_proxy_number: to})
    if(currentUser != null){
      const phoneNumber = parsePhoneNumberFromString(from)
      console.log('phoneNumber.formatNational()', phoneNumber.formatNational())
      const contact = await Contact.findOne({cell_phone: phoneNumber.formatNational()})
      const e164Phone = phone(currentUser.cell_phone)[0]
      await twilio.messages.create({from: to, body: text, to: e164Phone})
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
      
      await activity.save()
      res.send({
        status: true,
      })
    }  
}

const get = async(req, res) => {
  const { currentUser } = req
  const query = {...req.query}
  const contact = query['contact']
  console.log('contact', contact)
  const data = await Note.find({user :currentUser.id, contact: contact});
  console.log('data', data);
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