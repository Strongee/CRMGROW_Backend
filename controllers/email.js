const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const Activity = require('../models/activity');
const Contact = require('../models/contact');
const Email = require('../models/email');

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

  sgMail.send(msg).then((res)=>{
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

const bulkGmail = () => {
  const oauth2Client = new OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET, // Client Secret
    urls.GMAIL_AUTHORIZE_URL
  );

  oauth2Client.setCredentials({
    refresh_token: currentUser.refresh_token
  }); 
  const accessToken = oauth2Client.getAccessToken()
  const smtpTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
         type: "OAuth2",
         user: currentUser.email, 
         clientId: config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
         clientSecret: config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
         refreshToken: currentUser.refresh_token,
         accessToken: accessToken
    }
  });
  
  return new Promise((resolve, reject)=>{
    smtpTransport.sendMail(mailOptions, (error, response) => {
      if(error) {
        Activity.deleteOne({_id: activity.id}).catch(err=>{
          console.log('err', err)
        })
        error.push(_contact.email)
      } else{
        Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
          console.log('err', err)
        })
      }
      smtpTransport.close();
      resolve()
    });
  })
}
module.exports = {
    send,
    receive,
    bulkGmail
}