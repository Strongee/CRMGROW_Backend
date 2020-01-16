const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail')
const moment = require('moment');
const CronJob = require('cron').CronJob;
const fs = require('fs');
const AWS = require('aws-sdk')

const User = require('../models/user')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const Reminder = require('../models/reminder')
const Appointment = require('../models/appointment')
const Video = require('../models/video')
const Notification = require('../models/notification')

const config = require('../config/config')
const urls = require('../constants/urls')
const mail_contents = require('../constants/mail_contents')
const {VIDEO_PATH, TEMP_PATH} = require('../config/path')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)

const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const daily_report = new CronJob('0 21 * * 1-6', async() =>{

    await User.find({daily_report: true}).then(async(users)=>{
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
      
        const start = new Date();
        start.setHours(0,0,0,0);

        const end = new Date();
        end.setHours(20,59,59,999);
        for( let i = 0; i< users.length; i ++){
          const currentUser = users[i]
          const activity = await Activity.find({user :currentUser.id, created_at: {$gte: start, $lt: end}}).catch((err)=>{
          console.log('err: ', err)
          })

          let now = moment();
          const today = now.format("MMMM, dddd Do YYYY")
      
          let contacts = []
          for (let j =0; j < activity.length; j ++){
            const contact = await Contact.findOne({_id: activity[j].contacts}).catch((err)=>{
              console.log('err: ', err)
            })
            if( typeof contact.cell_phone == 'undefined') contact.cell_phone = ""
            let content = " <tr><td><h3 style='display: inline'>" + contact.first_name + contact.last_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
              "<p style='margin: 0px'>" + activity[j].content +"</p></td>" + 
              "<td><a href='" + urls.CONTACT_PAGE_URL + contact.id + "' style='text-decoration: none'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a></td></tr>"
            contacts.push(content)
          }
    
          const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$lt: end}}).catch((err)=>{
            console.log('err: ', err)
          })
          let overdue = [];
      
          for(let j = 0; j < _follow_up.length; j ++){
            const contact = await Contact.findOne({_id: _follow_up[j].contact}).catch((err)=>{
              console.log('err: ', err)
            }) 
            if( typeof contact.cell_phone == 'undefined') contact.cell_phone = ""
            const _overdue = "<tr><td><h3 style='display: inline'>" + contact.first_name + contact.last_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
            "<p style='margin: 0px'>" + _follow_up[j].content +"</p></td>" + 
            "<td><a href='" + urls.FOLLOWUP_PAGE_URL + contact.id + "' style='text-decoration: none'><img src='"+urls.DOMAIN_URL+"assets/images/followup.png'/></a></td></tr>"
            overdue.push(_overdue)
          }

          if(contacts.length > 0 || overdue.length > 0){
            const msg = {
              to: currentUser.email,
              from: mail_contents.DAILY_REPORT.MAIL,
              subject: mail_contents.DAILY_REPORT.SUBJECT,
              templateId: config.SENDGRID.SENDGRID_DAILY_REPORT_TEMPLATE,
              dynamic_template_data: {
                contacts: contacts,
                overdue: overdue,
                day: today
              },
            }
            sgMail.send(msg).then((res) => {
              console.log('mailres.errorcode', res[0].statusCode);
              if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
                console.log('Successful send to '+msg.to)
              }else {
                console.log('email sending err', msg.to+res[0].statusCode)
              }
            }).catch((err)=>{
              console.log('err: ', err)
            })
          }
        }
    }).catch((err)=>{
      console.log('err', err)
    })
  }, function () {
    console.log('Daily Report Job finished.');
}, false, 'US/Central'
)

const weekly_report = new CronJob({
  // Run at 21:00 Central time, only on friday
  cronTime: '00 21 * * Sun',
  onTick: async() => {
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
    await User.find({weekly_report: true}).then(async(users)=>{
      today = new Date();
      let day = today.getDay(),
          diff = today.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
      const monday = new Date(today.setDate(diff));
      monday.setHours(0,0,0,0);
  
      const end = new Date();
      end.setHours(20,59,59,999);
      for( let i = 0; i< users.length; i ++){
        const currentUser = users[i]
        const activity = await Activity.find({user :currentUser.id, created_at: {$gte: monday, $lt: end}}).sort({_id : -1 }).limit(15).catch((err)=>{
          console.log('err: ', err)
          })
        let now = moment();
        const today = now.format("MMMM, dddd Do YYYY")
        
        let contacts = []
        for (let j =0; j < activity.length; j ++){
          const contact = await Contact.findOne({_id: activity[j].contacts}).catch((err)=>{
            console.log('err: ', err)
            })
          if( typeof contact.cell_phone == 'undefined') contact.cell_phone = ""
          let content = "<tr><td><h3 style='display: inline'>" + contact.first_name + contact.last_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
          "<p style='margin: 0px'>" + activity[j].content +"</p></td>" + 
          "<td><a href='" + urls.CONTACT_PAGE_URL + contact.id + "' style='text-decoration: none'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a></td></tr>"
          contacts.push(content)
        }
      
        const _follow_up = await FollowUp.find({user :currentUser.id, status: 0, due_date: {$lt: end}}).catch((err)=>{
          console.log('err: ', err)
          });
        let overdue = [];
        
        for(let j = 0; j < _follow_up.length; j ++){
          const contact = await Contact.findOne({_id: _follow_up[j].contact}).catch((err)=>{
            console.log('err: ', err)
            }) 
            if( typeof contact.cell_phone == 'undefined') contact.cell_phone = ""
          const _overdue = "<tr><td><h3 style='display: inline'>" + contact.first_name + contact.last_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
          "<p style='margin: 0px'>" + _follow_up[j].content +"</p></td>" + 
          "<td><a href='" + urls.FOLLOWUP_PAGE_URL + contact.id + "' style='text-decoration: none'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a></td></tr>"
          overdue.push(_overdue)
        }
  
        if(contacts.length > 0 || overdue.length > 0){
          const msg = {
            to: currentUser.email,
            from: mail_contents.DAILY_REPORT.MAIL,
            subject: mail_contents.DAILY_REPORT.SUBJECT,
            templateId: config.SENDGRID.SENDGRID_DAILY_REPORT_TEMPLATE,
            dynamic_template_data: {
              contacts: contacts,
              overdue: overdue,
              day: today
            },
          }
          sgMail.send(msg).then((res) => {
            console.log('mailres.errorcode', res[0].statusCode);
            if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
              console.log('Successful send to '+msg.to)
            }else {
              console.log(res[0].statusCode)
            }
          }).catch((err)=>{
            console.log('err: ', err)
          })
        }
      }
    }).catch(err=>{
      console.log('err', err)
    })

  },
  start: false,
  timeZone: 'US/Central'
});

const reminder_job = new CronJob('0,30 * * * 0-6', async() =>{
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
  const due_date = new Date()
  due_date.setSeconds(0)
  due_date.setMilliseconds(000)

  const reminder_array = await Reminder.find({due_date: due_date, del: false}).catch(err=>{
    console.log(err)
  })
  
  for(let i=0; i<reminder_array.length; i ++){
    const reminder = reminder_array[i]
    if(reminder['type'] == 'follow_up'){
      const follow_up = await FollowUp.findOne({_id: reminder.follow_up, status: 0}).catch((err)=>{
        console.log('err: ', err)
        })     
      
      if(follow_up){
        const user = await User.findOne({_id: follow_up.user}).catch((err)=>{
          console.log('err: ', err)
          }) 
        const contact = await Contact.findOne({_id: follow_up.contact}).catch((err)=>{
          console.log('err: ', err)
          }) 
        const msg = {
          to: user.email,
          from: mail_contents.FOLLOWUP_REMINDER.MAIL,
          subject: mail_contents.FOLLOWUP_REMINDER.SUBJECT,
          templateId: config.SENDGRID.SENDGRID_FOLLOWUP_REMINDER_TEMPLATE,
          dynamic_template_data: {
            contact: contact.first_name + contact.last_name +  ' - ' + contact.email +  ' - ' + contact.cell_phone,
            due_date: moment(follow_up.due_date).utcOffset(user.time_zone).format('h:mm a'),
            content: follow_up.content,
            detailed_contact: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
          },
        }
  
        sgMail.send(msg).then((res) => {
          console.log('mailres.errorcode', res[0].statusCode);
          if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
            console.log('Successful send to '+msg.to)
          }else {
            console.log('email sending err', msg.to+res[0].statusCode)
          }
        }).catch((err)=>{
          console.log('err: ', err)
        })
  
        const e164Phone = phone(user.cell_phone)[0]
        const fromNumber = config.TWILIO.TWILIO_NUMBER
        console.info(`Send SMS: ${fromNumber} -> ${user.cell_phone} :`)
        if (!e164Phone) {
          const error = {
            error: 'Invalid Phone Number'
          }
          throw error // Invalid phone number
        }
   
        const title = `Follow up task due today at ${moment(follow_up.due_date).utcOffset(user.time_zone).format('h:mm a')} with contact name:` + '\n' +'\n'
          + contact.first_name + contact.last_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n' + '\n'
        const body = follow_up.content + '\n'
        const contact_link = urls.CONTACT_PAGE_URL + contact.id 
        twilio.messages.create({from: fromNumber, body: title+body + '\n'+contact_link,  to: e164Phone}).then(()=>{
          console.log(`Reminder at: ${moment(follow_up.due_date).utcOffset(user.time_zone).format('MMMM Do YYYY h:mm a')}`)
          console.log(`UTC timezone ${moment(follow_up.due_date).toISOString()}`)
        }).catch(err=>{
          console.log('send sms err: ',err)
        })
  
        reminder['del'] = true
    
        reminder.save().catch(err=>{
          console.log(err)
        })
      }
    }else{
      const appointment = await Appointment.findOne({_id: reminder.appointment}).catch((err)=>{
        console.log('err: ', err)
        }) 
      const user = await User.findOne({_id: appointment.user}).catch((err)=>{
        console.log('err: ', err)
        }) 
      const contact = await Contact.findOne({_id: appointment.contact}).catch((err)=>{
        console.log('err: ', err)
        }) 
      const msg = {
        to: user.email,
        from: mail_contents.APPOINTMENT_REMINDER.MAIL,
        subject: mail_contents.APPOINTMENT_REMINDER.SUBJECT,
        templateId: config.SENDGRID.SENDGRID_APPOINTMENT_REMINDER_TEMPLATE,
        dynamic_template_data: {
          contact: contact.first_name + contact.last_name +  ' - ' + contact.email +  ' - ' + contact.cell_phone,
          due_date: moment(appointment.due_date).utcOffset(user.time_zone).format('h:mm a'),
          content: appointment.content,
          detailed_contact: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
        },
      }

      sgMail.send(msg).then((res) => {
        console.log('mailres.errorcode', res[0].statusCode);
        if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
          console.log('Successful send to '+msg.to)
        }else {
          console.log('email sending err', msg.to+res[0].statusCode)
        }
      }).catch((err)=>{
        console.log('err: ', err)
      })

      const e164Phone = phone(user.cell_phone)[0]
      const fromNumber = config.TWILIO.TWILIO_NUMBER
      console.info(`Send SMS: ${fromNumber} -> ${user.cell_phone} :`)
      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number'
        }
        throw error // Invalid phone number
      }
    
      const title = `Appointment today at ${moment(appointment.due_date).utcOffset(user.time_zone).format('h:mm a')} with contact name:` + '\n' +'\n'
        + contact.first_name + contact.last_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n' + '\n'
      const body = appointment.content + '\n'
      const contact_link = urls.CONTACT_PAGE_URL + contact.id 
      twilio.messages.create({from: fromNumber, body: title+body + '\n'+contact_link,  to: e164Phone}).then(()=>{
        console.log(`Reminder at: ${moment(appointment.due_date).utcOffset(user.time_zone).format('h:mm a')}`)
      }).catch(err=>{
        console.log('send sms err: ',err)
      })
  
      reminder['del'] = true
      
      reminder.save().catch(err=>{
        console.log(err)
      })
    }
  }
}, function () {
  console.log('Reminder Job finished.');
}, false, 'US/Central'
)

const video_job = new CronJob('0 3 * * *', async() =>{
  const videos = await Video.find({converted: false, del: false}).catch(err=>{
    console.log('err', err)
  })
  
  if(videos){
    for(let i = 0; i <videos.length; i++){
      const video = videos[i]
      let file_path = video.path
      if(file_path){
        const file_name = video.path.slice(23)
      
        if (fs.existsSync(file_path)) {
          fs.readFile(file_path, (err, data) => {
              if (err) throw err;
              console.log('File read was successful', data)
              const today = new Date()
              const year = today.getYear()
              const month = today.getMonth()
              const params = {
                  Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
                  Key: 'video' +  year + '/' + month + '/' + file_name, 
                  Body: data,
                  ACL: 'public-read'
              };
              s3.upload(params, async (s3Err, upload)=>{
                if (s3Err) throw s3Err
                console.log(`File uploaded successfully at ${upload.Location}`)
                video['url'] = upload.Location
                video['converted'] = true
                video.save().then(()=>{
                  fs.unlinkSync(file_path)
                }).catch(err=>{
                  console.log('err', err)
                });  
              })
           });
        }
      } else {
        const file_name = video.url.slice(39)
        file_path = TEMP_PATH + file_name
        if (fs.existsSync(file_path)) {
          fs.readFile(file_path, (err, data) => {
              if (err) throw err;
              console.log('File read was successful', data)
              const today = new Date()
              const year = today.getYear()
              const month = today.getMonth()
              const params = {
                  Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
                  Key: 'video' +  year + '/' + month + '/' + file_name, 
                  Body: data,
                  ACL: 'public-read'
              };
              s3.upload(params, async (s3Err, upload)=>{
                if (s3Err) throw s3Err
                console.log(`File uploaded successfully at ${upload.Location}`)
                video['url'] = upload.Location
                video['converted'] = true
                video.save().then(()=>{
                  fs.unlinkSync(file_path)
                }).catch(err=>{
                  console.log('err', err)
                });  
              })
           });
        }
      }
    }
  }
}, function () {
  console.log('Convert Job finished.');
}, false, 'US/Central'
)

const signup_job = new CronJob('0,30 * * * 0-6', async() =>{
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
  
  const subscribers = await User.find({'welcome_email': false}).catch(err=>{
    console.log('err', err)
  })
  
  if(subscribers){
    for(let i = 0; i <subscribers.length; i++){
      const subscriber = subscribers[i]
      const created_at = new Date(subscriber['created_at']).getTime()
      const now = new Date().getTime()
      const offset = now-created_at
      if(offset>=(30*60*1000) && offset<60*60*1000){
          msg = {
            to: subscriber.email,
            from: mail_contents.WELCOME_SIGNUP.MAIL,
            templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_REACH,
            dynamic_template_data: {
              first_name: subscriber.user_name,
            }
          }
          sgMail.send(msg).then((res) => {
            console.log('mailres.errorcode', res[0].statusCode);
            if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
              console.log('Successful send to '+msg.to)
            }else {
              console.log('email sending err', msg.to+res[0].statusCode)
            }
          }).catch(err=>{
            console.log('err', err)
          })
      }
      if(offset>=(24*60*60*1000) && offset<24.5*60*60*1000){
          msg = {
            to: subscriber.email,
            from: mail_contents.WELCOME_SIGNUP.MAIL,
            templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_THIRD,
            dynamic_template_data: {
              first_name: subscriber.user_name,
              video_link: `<a href="${urls.INTRO_VIDEO_URL}">Click this link - Download Video</a>`,
              recruiting_material: `<a href="${urls.MATERIAL_VIEW_PAGE}">Material Page</a>`
            }
          }
          sgMail.send(msg).then((res) => {
            console.log('mailres.errorcode', res[0].statusCode);
            if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
              console.log('Successful send to '+msg.to)
            }else {
              console.log('email sending err', msg.to+res[0].statusCode)
            }
          }).catch(err=>{
            console.log('err', err)
          })
      }
      if(offset>=(48*60*60*1000) && offset<48.5*60*60*1000){
        msg = {
            to: subscriber.email,
            from: mail_contents.WELCOME_SIGNUP.MAIL,
            templateId: config.SENDGRID.SENDGRID_SIGNUP_FLOW_FORTH,
            dynamic_template_data: {
              first_name: subscriber.user_name,
              login_link: `<a href="${urls.LOGIN_URL}">Click here to login into your account</a>`
            }
          }
        sgMail.send(msg).then((res) => {
          console.log('mailres.errorcode', res[0].statusCode);
          if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
            console.log('Successful send to '+msg.to)
            subscriber['welcome_email'] = true
            subscriber.save().catch(err=>{
              console.log('err', err)
            })
          }else {
            console.log('email sending err', msg.to+res[0].statusCode)
          }
        }).catch(err=>{
          console.log('err', err)
        })
      }
    }
  }
}, function () {
  console.log('Reminder Job finished.');
}, false, 'US/Central'
)

const notification_check = new CronJob('0 21 */3 * *', async() =>{
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
  
  const payment_notification = await Notification.findOne({type: 'urgent', criteria: 'subscription_failed'})
  
  if(payment_notification){
    const subscribers = await User.find({'subscription.is_failed': true, del: false}).catch(err=>{
      console.log('err', err)
    })
    
    if(subscribers){
      for(let i = 0; i <subscribers.length; i++){
        const subscriber = subscribers[i]
        const subscription = subscriber['subscription']
        
        msg = {
          to: subscriber.email,
          from: mail_contents.SUPPORT_CRMGROW.MAIL,
          templateId: config.SENDGRID.SENDGRID_NOTIFICATION,
          dynamic_template_data: {
            first_name: subscriber.user_name,
            content: payment_notification['content']
          }
        }
        sgMail.send(msg).then((res) => {
          console.log('mailres.errorcode', res[0].statusCode);
          if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
            console.log('Successful send to '+msg.to)
          }else {
            console.log('email sending err', msg.to+res[0].statusCode)
          }
        }).catch(err=>{
          console.log('err', err)
        })
      }
    }
  }
  
  const logger_notification = await Notification.findOne({type: 'urgent', criteria: 'long_out'})
  if(logger_notification){
    let startdate = moment();
    startdate = startdate.subtract(30, "days");
    const subscribers = await User.find({last_logged: {$lt: startdate}, del: false}).catch(err=>{
      console.log('err', err)
    });
    if(subscribers){
      for(let i = 0; i <subscribers.length; i++){
        const subscriber = subscribers[i]
        const subscription = subscriber['subscription']
        
        msg = {
          to: subscriber.email,
          from: mail_contents.SUPPORT_CRMGROW.MAIL,
          templateId: config.SENDGRID.SENDGRID_NOTIFICATION,
          dynamic_template_data: {
            first_name: subscriber.user_name,
            content: logger_notification['content']
          }
        }
        sgMail.send(msg).then((res) => {
          console.log('mailres.errorcode', res[0].statusCode);
          if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
            console.log('Successful send to '+msg.to)
          }else {
            console.log('email sending err', msg.to+res[0].statusCode)
          }
        }).catch(err=>{
          console.log('err', err)
        })
      }
    }
  }
  
  const notifications = await Notification.find({type: 'static', sent: false});
  if(notifications){
    const subscribers = await User.find({del: false}).catch(err=>{
      console.log('err', err)
    })
    for(let i = 0; i <notifications.length; i++){
      const notification = notification[i]
      
      for(let j=0; j<subscribers.length; j++){
       const subscriber = subscribers[i]
        msg = {
          to: subscriber.email,
          from: mail_contents.SUPPORT_CRMGROW.MAIL,
          templateId: config.SENDGRID.SENDGRID_NOTIFICATION,
          dynamic_template_data: {
            content: subscriber.user_name,
            content: notification.content
          }
        }
        sgMail.send(msg).then((res) => {
          console.log('mailres.errorcode', res[0].statusCode);
          if(res[0].statusCode >= 200 && res[0].statusCode < 400){                
            console.log('Successful send to '+msg.to)
            notification['sent'] = true

          }else {
            console.log('email sending err', msg.to+res[0].statusCode)
          }
        }).catch(err=>{
          console.log('err', err)
        })
      }
    }
  }
  
  let startdate = moment();
  startdate = startdate.subtract(7, "days");
  const old_notifications = await Notification.find({type: 'static', created_at: {$lt: startdate}}).catch(err=>{
    console.log('err', err)
  });
  for(let i=0; i<old_notifications.length; i++){
    const old_notification = old_notifications[i]
    old_notification['del'] = false
    old_notification.save().catch(err=>{
      console.log('err', err)
    })
  }
}, function () {
  console.log('Notification Check Job finished.');
}, false, 'US/Central'
)


signup_job.start()
reminder_job.start()
weekly_report.start()
video_job.start()
notification_check.start()