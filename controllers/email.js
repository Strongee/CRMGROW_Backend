const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const moment = require('moment');
const OAuth2 = google.auth.OAuth2;
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const mail_contents = require('../constants/mail_contents');
const config = require('../config/config');
const urls = require('../constants/urls');
const uuidv1 = require('uuid/v1');

const credentials = {
  clientID: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token'
}
const oauth2 = require('simple-oauth2')(credentials)
var graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const receive = async(req, res) => {
  console.log(req.body)
  return res.send({
    status: true
  })
}

const send = async (req, res) => {
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const { currentUser } = req
  const { cc, bcc, to, subject, content, contacts } = req.body

  if (typeof subject == 'undefined' || subject == "") {
    return res.status(400).send({
      status: false,
      error: 'Subject email must be specified'
    })
  }
  
  const msg = {
    from: `${currentUser.user_name} <${currentUser.email}>`,
    subject: subject,
    to: to,
    cc: cc,
    bcc: bcc,
    text: content,
    html: '<html><head><title>Email</title></head><body><p>' + content + '</p><br/><br/>' + currentUser.email_signature + '</body></html>',
  };

  sgMail.send(msg).then( async (res) => {
    console.log('mailres.errorcode', res[0].statusCode);
    if(res[0].statusCode >= 200 && res[0].statusCode < 400){
      console.log('Successful send to '+msg.to)
      console.log('res', res)
      const email = new Email({
        ...req.body,
        user: currentUser.id,
        updated_at: new Date(),
        created_at: new Date()
      })
    
      const _email = await email.save().then().catch(err => {
        console.log('err', err)
      })
      let data_list = []
      for (let i = 0; i < contacts.length; i++) {
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
        myJSON = JSON.stringify(_email)
        const data = JSON.parse(myJSON);
        data.activity = _activity
        data_list.push(data)
      }
    
      return res.send({
        status: true,
        data: data_list
      })
    }else {
      console.log('email sending err', msg.to+res[0].statusCode)
    }
  }).catch(err => {
    console.log('err', err)
  })
}

const bulkGmail = async(req, res) => {
  const { currentUser } = req
  let { cc, bcc, to, subject, content, contacts } = req.body
  let promise_array = []
  let error = []
  
  const token = JSON.parse(currentUser.google_refresh_token)
  const smtpTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
         type: "oauth2",
         user: currentUser.email, 
         clientId: config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
         clientSecret: config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
         refreshToken: token.refresh_token
    }
  });
  
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
    
    const mailOptions = {
      from: `${currentUser.user_name} <${currentUser.email}>`,
      to: _contact.email,
      subject: subject,
      cc: cc,
      bcc: bcc,
      generateTextFromHTML: true,
      html: '<html><head><title>Email</title></head><body><p>' + content + '</p><br/><br/>' + currentUser.email_signature + '</body></html>',
    };
    
    const promise = new Promise((resolve, reject)=>{
      smtpTransport.sendMail(mailOptions, async (err, response) => {
        if(err) {
          console.log('err', err)
          error.push(contacts[i])
          resolve()
        } else{
          const email = new Email({
            ...req.body,
            contact: contacts[i],
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
          
          const _activity = await activity.save().then().catch(err=>{
            console.log('err', err)
          })
          Contact.findByIdAndUpdate(contacts[i], { $set: { last_activity: _activity.id } }).then(()=>{
            resolve()
          }).catch(err => {
            console.log('err', err)
          })
        }
        smtpTransport.close();
      });
    })
    promise_array.push(promise)
  }
  
  Promise.all(promise_array).then(()=>{
    if(error.length>0){
      return res.status(400).json({
        status: false,
        error: error
      })
    }
    return res.send({
      status: true,
    })
  }).catch((err)=>{
    console.log('err', err)
    return res.status(400).json({
      status: false,
      error: err
    })
  })
}

const bulkOutlook = async(req, res) => {
  const { currentUser } = req
  let { cc, bcc, to, subject, content, contacts } = req.body
  let promise_array = []
  let error = []
  
  let token = oauth2.accessToken.create({ refresh_token: currentUser.outlook_refresh_token, expires_in: 0})
  let accessToken
  
  await new Promise((resolve, reject) => {
    token.refresh(function(error, result) {
      if (error) {
        reject(error.message)
      }
      else {
        resolve(result.token);
      }
    })
  }).then((token)=>{
    accessToken = token.access_token
    
  }).catch((error) => {
    console.log('error', error)
  })
  
  const client = graph.Client.init({
    // Use the provided access token to authenticate
    // requests
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
  
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
    
    const message_id = uuidv1()
    content += `<img src='${urls.TRACK_URL}${message_id}/>`
    const sendMail = {
            message: {
              subject: subject,
              from: {
                emailAddress: {
                  name: currentUser.user_name,
                  address: currentUser.email
                }
              },
              body: {
                contentType: "HTML",
                content: '<html><head><title>Email</title></head><body><p>' + content + '</p><br/><br/>' + currentUser.email_signature + '</body></html>',
              },
              
              toRecipients: [
                {
                  emailAddress: {
                    address: _contact.email,
                  }
                }
              ],
            },
            saveToSentItems: "true"
          };
          
    const promise = new Promise((resolve, reject)=>{
      client.api('/me/sendMail')
      .post(sendMail).then( async ()=>{
        const email = new Email({
          ...req.body,
          message_id: message_id,
          contact: contacts[i],
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
      }).catch(err=>{
        console.log('err', err)
        if(error.code == 'ErrorMessageSubmissionBlocked'){
          return res.status(400).json({
            status: false,
            error: error.message || 'Please go to the login into your Email box and follow instruction'
          })
        }else {
          error.push(contacts[i])
        }
      });
      resolve()
    })
    promise_array.push(promise)
  }
  
  Promise.all(promise_array).then(()=>{
    if(error.length>0){
      return res.status(400).json({
        status: false,
        error: error
      })
    }
    return res.send({
      status: true,
    })
  }).catch((err)=>{
    console.log('err', err)
    return res.status(400).json({
      status: false,
      error: err
    })
  })
}

const openTrack = async(req, res) => {
  const message_id = req.params.id
  const _email = await Email.findOne({message_id: message_id}).catch(err=>{
    console.log('err', err)
  })
  const user = await User.findOne({_id: _email.user}).catch(err=>{
    console.log('err', err)
  })
  
  const contact = await Contact.findOne({contact: _email.contact}).catch(err=>{
    console.log('err', err)
  })
  
  let opened = new Date();
  
  const created_at = moment(opened).utcOffset(user.time_zone).format('h:mm a')
  let action = 'opened'
  const email_activity = await Activity.findOne({contacts: contact.id, emails: _email.id}).catch(err=>{
      console.log('err', err)
  })
    
  let reopened = moment();
  reopened = reopened.subtract(1, "hours");
  const old_activity = await EmailTracker.findOne({activity: email_activity.id, type: 'open', created_at: {$gte: startdate}}).catch(err=>{
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
    
    
    const msg = {
      to: user.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
      templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
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
}

module.exports = {
    send,
    receive,
    openTrack,
    bulkGmail,
    bulkOutlook,
}