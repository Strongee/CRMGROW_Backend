const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const moment = require('moment');
const path = require('path')
const mime = require('mime-types')
const OAuth2 = google.auth.OAuth2;
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');
const EmailTracker = require('../models/email_tracker');
const User = require('../models/user');
const mail_contents = require('../constants/mail_contents');
const config = require('../config/config');
const urls = require('../constants/urls');
const uuidv1 = require('uuid/v1');
const { TRAKER_PATH } = require('../config/path')
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

const Base64 = require('js-base64').Base64;
const makeBody = (to, from, subject, message) => {
  var str = ["Content-Type: text/html; charset=\"UTF-8\"\n", "MIME-Version:1.0\n", "Content-Transfer-Encoding: 7bit\n",
    "to: ", to, "\n", "from: ", from, "\n", "subject: ", subject, "\n\n", message].join('');
  var encodedMail = Base64.encodeURI(str);
  return encodedMail;
}

const sgMail = require('@sendgrid/mail')

const receive = async (req, res) => {
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

  sgMail.send(msg).then(async (res) => {
    console.log('mailres.errorcode', res[0].statusCode);
    if (res[0].statusCode >= 200 && res[0].statusCode < 400) {
      console.log('Successful send to ' + msg.to)
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
    } else {
      console.log('email sending err', msg.to + res[0].statusCode)
    }
  }).catch(err => {
    console.log('err', err)
  })
}

const bulkGmail = async (req, res) => {
  const { currentUser } = req
  let { cc, bcc, to, subject, content, contacts } = req.body
  let promise_array = []
  let error = []

  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  )
  const token = JSON.parse(currentUser.google_refresh_token)
  oauth2Client.setCredentials({ refresh_token: token.refresh_token })
  let gmail = google.gmail({ auth: oauth2Client, version: 'v1' });

  if (typeof subject == 'undefined' || subject == "") {
    return res.status(400).send({
      status: false,
      error: 'Subject email must be specified'
    })
  }

  for (let i = 0; i < contacts.length; i++) {
    const _contact = await Contact.findOne({ _id: contacts[i] })
    subject = subject.replace(/{user_name}/ig, currentUser.user_name)
      .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
      .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
      .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)

    content = content.replace(/{user_name}/ig, currentUser.user_name)
      .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
      .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
      .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)

    const message_id = uuidv1()
    content += `<img src='${urls.TRACK_URL}${message_id}' style='display:none'/>`

    const email_content = '<html><head><title>Email</title></head><body><p>' + content + '</p><br/><br/>' + currentUser.email_signature + '</body></html>';
    const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, subject, email_content);

    const promise = new Promise((resolve, reject) => {
      gmail.users.messages.send({
        'userId': currentUser.email,
        'resource': {
          raw: rawContent
        }
      }, async (err, response) => {
        if (err) {
          console.log('err', err)
          error.push(contacts[i])
          resolve()
        }
        else {
          const email = new Email({
            ...req.body,
            message_id: message_id,
            contacts: contacts[i],
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

          const _activity = await activity.save().then().catch(err => {
            console.log('err', err)
          })
          Contact.findByIdAndUpdate(contacts[i], { $set: { last_activity: _activity.id } }).then(() => {
            resolve()
          }).catch(err => {
            console.log('err', err)
          })
        }
        resolve();
      })
    })
    promise_array.push(promise)
  }

  Promise.all(promise_array).then(() => {
    if (error.length > 0) {
      return res.status(400).json({
        status: false,
        error: error
      })
    }
    return res.send({
      status: true,
    })
  }).catch((err) => {
    console.log('err', err)
    return res.status(400).json({
      status: false,
      error: err
    })
  })
}

const listGmail = async (req, res) => {
  const { currentUser } = req
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  )
  const token = JSON.parse(currentUser.google_refresh_token)
  oauth2Client.setCredentials({ refresh_token: token.refresh_token })
  let gmail = google.gmail({ auth: oauth2Client, version: 'v1' });
  gmail.users.messages.list({
    includeSpamTrash: false,
    userId: currentUser.email
  }, function (err, response) {
    console.log(err);
    const data = response.data
    return res.send({
      data
    })
  });
}

const getGmail = async (req, res) => {
  const { currentUser } = req
  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  )
  const token = JSON.parse(currentUser.google_refresh_token)
  oauth2Client.setCredentials({ refresh_token: token.refresh_token })

  let gmail = google.gmail({ auth: oauth2Client, version: 'v1' });
  gmail.users.messages.get({
    'userId': currentUser.email,
    'id': req.params.id
  }, function (err, response) {
    console.log(err)
    const data = response.data
    return res.send({
      data
    })
  })
}

const bulkOutlook = async (req, res) => {
  const { currentUser } = req
  let { cc, bcc, to, subject, content, contacts } = req.body
  let promise_array = []
  let error = []

  let token = oauth2.accessToken.create({ refresh_token: currentUser.outlook_refresh_token, expires_in: 0 })
  let accessToken

  await new Promise((resolve, reject) => {
    token.refresh(function (error, result) {
      if (error) {
        reject(error.message)
      }
      else {
        resolve(result.token);
      }
    })
  }).then((token) => {
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
    const _contact = await Contact.findOne({ _id: contacts[i] })
    subject = subject.replace(/{user_name}/ig, currentUser.user_name)
      .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
      .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
      .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)

    content = content.replace(/{user_name}/ig, currentUser.user_name)
      .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
      .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
      .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)

    const message_id = uuidv1()
    content += `<img src='${urls.TRACK_URL}${message_id}' style='display:none'/>`
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

    const promise = new Promise((resolve, reject) => {
      client.api('/me/sendMail')
      .post(sendMail).then( async ()=>{
        const email = new Email({
          ...req.body,
          message_id: message_id,
          contacts: contacts[i],
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
        }).catch(err => {
          console.log('err', err)
          if (error.code == 'ErrorMessageSubmissionBlocked') {
            return res.status(400).json({
              status: false,
              error: error.message || 'Please go to the login into your Email box and follow instruction'
            })
          } else {
            error.push(contacts[i])
          }
        });
      resolve()
    })
    promise_array.push(promise)
  }

  Promise.all(promise_array).then(() => {
    if (error.length > 0) {
      return res.status(400).json({
        status: false,
        error: error
      })
    }
    return res.send({
      status: true,
    })
  }).catch((err) => {
    console.log('err', err)
    return res.status(400).json({
      status: false,
      error: err
    })
  })
}

const openTrack = async (req, res) => {
  const message_id = req.params.id
  const _email = await Email.findOne({ message_id: message_id }).catch(err => {
    console.log('err', err)
  })
  const user = await User.findOne({ _id: _email.user }).catch(err => {
    console.log('err', err)
  })

  const contact = await Contact.findOne({ _id: _email.contacts }).catch(err => {
    console.log('err', err)
  })

  let opened = new Date();
  
  const created_at = moment(opened).utcOffset(user.time_zone).format('h:mm a')
  let action = 'opened'
  const email_activity = await Activity.findOne({ contacts: contact.id, emails: _email.id }).catch(err => {
    console.log('err', err)
  })

  let reopened = moment();
  reopened = reopened.subtract(1, "hours");
  const old_activity = await EmailTracker.findOne({ activity: email_activity.id, type: 'open', created_at: { $gte: reopened } }).catch(err => {
    console.log('err', err)
  })

  if (!old_activity) {
    const email_tracker = new EmailTracker({
      user: user.id,
      contact: contact.id,
      email: _email.id,
      type: 'open',
      activity: email_activity.id,
      updated_at: opened,
      created_at: opened,
    })

    const _email_tracker = await email_tracker.save().then().catch(err => {
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

    const _activity = await activity.save().then().catch(err => {
      console.log('err', err)
    })

    Contact.findByIdAndUpdate(contact.id, { $set: { last_activity: _activity.id } }).catch(err => {
      console.log('err', err)
    })

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
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity: contact.first_name + ' ' + action + ' email: ' + _email.subject + ' at ' + created_at,
        detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='" + urls.DOMAIN_URL + "assets/images/contact.png'/></a>"
      },
    };
    sgMail.send(msg).catch(err => console.error(err))
  }

  const contentType = mime.contentType(path.extname(TRAKER_PATH))
  res.set('Content-Type', contentType)
  return res.sendFile(TRAKER_PATH)
}

const bulkEmail = async (req, res) => {
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY)

  const { currentUser } = req
  let { to, cc, bcc, contacts, content, attachments, subject } = req.body

  let promise_array = [];
  let error = [];

  for (let i = 0; i < contacts.length; i++) {
    const _contact = await Contact.findOne({ _id: contacts[0] })
    subject = subject.replace(/{user_name}/ig, currentUser.user_name)
      .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
      .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
      .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
    content = content.replace(/{user_name}/ig, currentUser.user_name)
      .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
      .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
      .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)

    const msg = {
      from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
      to: _contact.email,
      replyTo: currentUser.email,
      subject: subject,
      attachments: attachments,
      html: content + '<br/><br/>' + currentUser.email_signature
    };

    const promise = new Promise((resolve, reject) => {
      sgMail.send(msg).then(async (_res) => {
        if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
          const email = new Email({
            ...req.body,
            contact: contacts[i],
            message_id: _res[0].headers['x-message-id'],
            user: currentUser.id,
            updated_at: new Date(),
            created_at: new Date(),
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

          resolve()
        }
        else {
          console.log('email sending err', msg.to + _res[0].statusCode)
          error.push(contacts[i])
          resolve()
        }
      }).catch(err => {
        console.log('err', err)
        error.push(contacts[i])
        resolve()
      })
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

const bulkYahoo = async(req, res) => {
  
  const {currentUser} = req
  const mailOptions = {
    from: 'garrettsteve1@yahoo.com',
    to: 'amazingskill8001@gmail.com',
    subject: 'test again',
    text: 'Test',
    html: '<p>Test</p>',
  };
  
  console.log('yahoo.....', currentUser.yahoo_refresh_token)
  const transporter = nodemailer.createTransport({
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secureConnection: true,
      service: "Yahoo",
      auth: {
        type: "oauth2",
        user: 'garrettsteve1@yahoo.com', 
        clientId: config.YAHOO_CLIENT.YAHOO_CLIENT_ID,
        clientSecret: config.YAHOO_CLIENT.YAHOO_CLIENT_CECRET,
        refreshToken: currentUser.yahoo_refresh_token,
        accessToken: 'J1NWafqZ5w77uqJeulrWGowNGEzemT8Bk_eV3Sd7JfC1IVcfVWN2K6EuM3.1I89H791Ao93KaoMzvSITLkyap7bVpyY2qurD_YFQ69dviaekCN9Nw5h_pxHdOazL8ZIn_QKP_EJW15Zzbm05.H8EkUqvsmShDneXsPyM6l9.jF0kKTM_9ir8UgIqoCRRIsun3jy_6r0ZHdQD08nz14CJgXg3U_6yfk7FeKRIZrfSmGPnemiPE1EYd7hS4qg1d6gOUVRcVaJZhbfJsVLNlCd5OK3iXLtk2PkWwCeoFXT6fartt2LdohRw636GzwmGoDYuufySxzf0SOC.ZU9qrdEla4Yblwy_H8aImxcOmake0IvFF2mEAsbrAZVwHdHMW_k35cYT3vMkyBlFf6gfBpVQnmjSlwvKPU27NcFN8oRQsSgnfiFBSamXQ.gXqb1qz8WEvtJtAIcai3qefxDlqfDucSArpNX72_j_SYO0YwfHc25Z15nCsBkQD_ueBYZAOGx.k8IJrgPgPGJ6m2v0.N7sMdEoezOegn96zR1RSuxAExQ35ldXfLbUGAp_vw7LeO_XTOynbTeoxQHgs5c6.JiQ8B8rPAIBmH9I1PuPEIOp_OR0Yi7t0jn5iXvrKHmvyOge0stPsGj4B28wfSyMPC1RJpYwu5Dh81DkAxVoeyjmHtx4aREtUfH8N6pS4N.WkWEJy7gp0MBwENYdY6QUdvb5EK7ovFJGX7hD8YWqYwIgmtAAWV8FUcow322slGZdeN_Vs7jP0mwofojSIYu9rCVMIKWaSIiS_i1MAqTrezJHfq4LetKS8s1wwgwx0t9Cx1kznJMSdMxOEzW2i4fFsWHan_M_XeOxal7pf8T8dw5F2kfRBTC9uIVW6xdRRFgchbCd.UXDoeSWh6D6E2Antm2qjRkGuBxlIZJsnm_2Rs5JLspwHvXwXdIgJn0uXPq5Hutl8EyWX4pFRU2JKQRR9GvGGmI77OLyONRO_aG4kftbwZKpm5UmDpkYlCPhaqIhk1pLDDFfnkC6XJIx4g6FxJQyOvkuuH2B.RYtSxdq7O4n7jq7uS5OyakM0zkKAE7NA6XeE_VGGEmRbAgse890bizIZg--'
      },
  });
  transporter.sendMail(mailOptions, (err, res) => {
      if (err) {
          return console.log(err);
      } else {
          console.log(JSON.stringify(res));
      }
  });
}

module.exports = {
  send,
  receive,
  openTrack,
  getGmail,
  bulkGmail,
  bulkYahoo,
  listGmail,
  bulkOutlook,
  bulkEmail
}