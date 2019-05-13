const phone = require('phone')
const Contact = require('../models/contact');
const Activity = require('../models/activity');
const SMS = require('../models/sms')
const urls = require('../constants/urls')
const config = require('../config/config')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const fromNumber = config.TWILIO.TWILIO_FROM

const twilio = require('twilio')(accountSid, authToken)

const send = async(req, res) => {
  const { currentUser } = req
  const {text} = req.body
  const contact = Contact.findOne({_id: req.params.id})
  const e164Phone = phone('+8618204158455')[0]
  console.info(`Send SMS: ${fromNumber} -> ${contact.cell_phone} :`, text)

  if (!e164Phone) {
    const error = {
      error: 'Invalid Phone Number'
    }

    throw error // Invalid phone number
  }

    await twilio.messages.create({from: fromNumber, body: text, to: e164Phone, statusCallback: urls.SMS_RECEIVE_URL+currentUser.id,})

    const sms = new SMS({
        text: req.body.text,
        contact: req.params.id,
        phone: e164Phone,
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
          myJSON = JSON.stringify(_note)
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
    console.log('here')
    console.log(req.body.Body)
    console.log(req.body.From) 

    const sms = await SMS.findOne({user: req.params.id, phone: req.body.From})
    const contact = await Contact.findOne({_id: sms.contact})
    const user = await User.findOne({_id: req.params.id})
    const e164Phone = phone('+8617172498837')[0]
    
    await twilio.messages.create({from: fromNumber, body: text, to: e164Phone, statusCallback: urls.SMS_REPLY_URL+contact.id,})
    res.send({
        status: true,
      })
}

const reply = async(req, res) => {
    console.log('there')
    console.log(req.body.Body)
    console.log(req.body.From) 
    res.send({
        status: true,
      })
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
    reply
}