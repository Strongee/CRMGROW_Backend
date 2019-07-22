  const mongoose = require('mongoose')
const User = require('../models/user')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const FollowUp = require('../models/follow_up')
const sgMail = require('@sendgrid/mail')
const moment = require('moment');
const CronJob = require('cron').CronJob;

const config = require('../config/config')
const urls = require('../constants/urls')
const mail_contents = require('../constants/mail_contents')

const { DB_PORT } = require('../config/database');

mongoose.set('useCreateIndex', true)
mongoose.connect(DB_PORT, {useNewUrlParser: true})
.then(() => console.log('Connecting to database successful'))
.catch(err => console.error('Could not connect to mongo DB', err))

const daily_report = new CronJob('5 * * * * 1-6', async() =>{

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
          const today = now.format("dddd, MMMM Do YYYY")
      
          let contacts = []
          for (let j =0; j < activity.length; j ++){
            const contact = await Contact.findOne({_id: activity[j].contacts}).catch((err)=>{
              console.log('err: ', err)
            })
            if( typeof contact.cell_phone == 'undefined') contact.cell_phone = ""
            let content = "<div class='content' style='display: flex; padding-top:10px; padding-bottom:10px; margin-right:10px;max-width: 700px;padding-left:30px; border-bottom: 1px solid #afaaaa;'>"+
              "<div class='contact'><h3 style='display: inline'>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
              "<p style='margin: 0px'>" + activity[j].content +"</p></div>" + 
              "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.CONTACT_PAGE_URL + contact.id + "' style='text-decoration: none'> View Contact</a></button></div>"
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
            const _overdue = "<div class='content' style='display: flex; padding-top:10px; padding-bottom: 10px; margin-right:10px;max-width: 700px ; padding-left:30px; border-bottom: 1px solid #afaaaa;'>" + 
            "<div class='contact'><h3 style='display: inline'>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
            "<p style='margin: 0px'>" + _follow_up[j].content +"</p></div>" + 
            "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.FOLLOWUP_PAGE_URL + contact.id + "' style='text-decoration: none'> View FollowUp</a></button></div>"
            overdue.push(_overdue)
          }
    
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
    }).catch((err)=>{
      console.log('err', err)
    })
  }, function () {
    console.log('DelCron Job finished.');
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
        const today = now.format("dddd, MMMM Do YYYY")
        
        let contacts = []
        for (let j =0; j < activity.length; j ++){
          const contact = await Contact.findOne({_id: activity[j].contacts}).catch((err)=>{
            console.log('err: ', err)
            })
          if( typeof contact.cell_phone == 'undefined') contact.cell_phone = ""
          let content = "<div class='content' style='display: flex; padding-top:10px; padding-bottom: 10px; margin-right:10px;max-width: 700px ; padding-left:30px; border-bottom: 1px solid #afaaaa;'>" + 
          "<div class='contact'><h3 style='display: inline'>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
          "<p style='margin: 0px'>" + activity[j].content +"</p></div>" + 
          "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.CONTACT_PAGE_URL + contact.id + "' style='text-decoration: none'> View</a></button></div>"
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
          const _overdue = "<div class='content' style='display: flex; padding-top:10px; padding-bottom: 10px; margin-right:10px;max-width: 700px ;padding-left:30px; border-bottom: 1px solid #afaaaa;'>" + 
          "<div class='contact'><h3 style='display: inline'>" + contact.first_name + "</h3><p style='margin: 0px'>" + contact.email +" " + contact.cell_phone + "</p>" +
          "<p style='margin: 0px'>" + _follow_up[j].content +"</p></div>" + 
          "<button style='background-color: white; color:#0078d4; max-width:100px; height:30px; margin: auto 10px; border: 1px solid; border-left: 4px solid #0078d4; cursor:pointer;'><a href='" + urls.FOLLOWUP_PAGE_URL + contact.id + "' style='text-decoration: none'> View FollowUp</a></button></div>"
          overdue.push(_overdue)
        }
  
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
        await sgMail.send(msg).then((res) => {
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
    }).catch(err=>{
      console.log('err', err)
    })

  },
  start: false,
  timeZone: 'US/Central'
});

daily_report.start()
weekly_report.start()
