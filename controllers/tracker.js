const User = require('../models/user')
const Contact = require('../models/contact');
const PDFTracker = require('../models/pdf_tracker');
const PDF = require('../models/pdf');
const VideoTracker = require('../models/video_tracker');
const Video = require('../models/video');
const Activity = require('../models/activity');
const sgMail = require('@sendgrid/mail')
const urls = require('../constants/urls')
const mail_contents = require('../constants/mail_contents')
const config = require('../config/config')
const webpush = require('web-push');
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)

const createPDF = async(data) => {
  const pdf_tracker = new PDFTracker({
    ...data,
    updated_at: new Date(),
    created_at: new Date(),
  })
  
  return await pdf_tracker.save()
}

const disconnectPDF = async(pdf_tracker_id) =>{
  const query = await PDFTracker.findOne({_id: pdf_tracker_id})
  const currentUser = await User.findOne({_id: query['user']})
  const contact = await Contact.findOne({_id: query['contact']})
  const pdf = await PDF.findOne({_id: query['pdf']})

  const d = (query['duration']/1000)
  var h = Math.floor(d / 3600);
  var m = Math.floor(d % 3600 / 60);
  var s = Math.floor(d % 3600 % 60);

  if (h   < 10) {h   = "0"+h;}
  if (m < 10) {m = "0"+m;}
  if (s < 10) {s = "0"+s;}
  let timeWatched = h + ':' + m + ':' + s

  // send desktop notification
  if(currentUser.desktop_notification == true){
    webpush.setVapidDetails(
      'mailto:support@crmgrow.com',
      config.VAPID.PUBLIC_VAPID_KEY,
      config.VAPID.PRIVATE_VAPID_KEY
    )
    
    const subscription = JSON.parse(currentUser.desktop_notification_subscription)
    const title = contact.first_name + ' reviewed pdf -' + pdf.title 
    const body = 'Watched ' + timeWatched + ' at ' + query['created_at']
    const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico"}})
    webpush.sendNotification(subscription, playload).catch(err => console.error(err))
  }

   // send text notification
   if(currentUser.text_notification == true){
    const e164Phone = phone(currentUser.cell_phone)[0]
    const fromNumber = config.TWILIO.TWILIO_NUMBER
    console.info(`Send SMS: ${fromNumber} -> ${currentUser.cell_phone} :`)
    if (!e164Phone) {
      const error = {
        error: 'Invalid Phone Number'
      }
      throw error // Invalid phone number
    }
  
    const title = contact.first_name + ' reviewed pdf -' + pdf.title + '\n'
    const body = 'Watched ' + timeWatched + ' at ' + query['created_at'] + '\n'
    const contact_link = urls.CONTACT_PAGE_URL + contact.id 
    twilio.messages.create({from: fromNumber, body: title+body + '\n'+contact_link,  to: e164Phone}).catch(err=>{
      console.log('send sms err: ',err)
    })
  }

  // send email notification
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const msg = {
    to: currentUser.email,
    from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
    subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
    templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
    dynamic_template_data: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone_number: contact.cell_phone,
      email: contact.email,
      activity: contact.first_name + ' reviewed pdf - <b>' + pdf.title + '</b>',
      duration: 'Watched <b>' + timeWatched + ' </b>at ' + query['created_at'],
      detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "' style='text-decoration: none; color: white; font-size: 16px;'>View Contact</a>"
    },
  };

  sgMail.send(msg).then().catch(err=>{
    console.log('send message err: ',err)
  })


    const activity = new Activity({
      content: contact.first_name + ' reviewed pdf',
      contacts: query.contact,
      user: currentUser.id,
      type: 'pdf_trackers',
      pdf_trackers: query.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().catch(err=>{
      console.log('send message err: ',err)
    })
 
}

const updatePDF = async(duration, pdf_tracker_id) =>{
  const pdf_tracker = await PDFTracker.findOne({_id: pdf_tracker_id});
  pdf_tracker['duration'] = duration
  pdf_tracker['updated_at'] = new Date()
  pdf_tracker.save()
}
  
  const createVideo = async(data) => {
    const video_tracker = new VideoTracker({
      ...data,
      updated_at: new Date(),
      created_at: new Date(),
    })
    
    return await video_tracker.save()
  }

  const disconnectVideo = async(video_tracker_id) =>{
    const query = await VideoTracker.findOne({_id: video_tracker_id})
    const currentUser = await User.findOne({_id: query['user']})
    const contact = await Contact.findOne({_id: query['contact']})
    const video = await Video.findOne({_id: query['video']})
  
    const activity = new Activity({
      content: contact.first_name + ' watched video',
      contacts: query.contact,
      user: currentUser.id,
      type: 'video_trackers',
      video_trackers: query.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().catch(err=>{
      console.log(err)
    })

    const d = (query['duration']/1000)
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);
  
    if (h   < 10) {h   = "0"+h;}
    if (m < 10) {m = "0"+m;}
    if (s < 10) {s = "0"+s;}
    let timeWatched = h + ':' + m + ':' + s
  
    const tD = Math.floor(video.duration/1000);
    var tH = Math.floor(tD / 3600);
    var tM = Math.floor(tD % 3600 / 60);
    var tS = Math.floor(tD % 3600 % 60);
  
    if (tH   < 10) {tH   = "0"+tH;}
    if (tM < 10) {tM = "0"+tM;}
    if (tS < 10) {tS = "0"+tS;}
  
    let timeTotal = tH + ':' + tM + ':' + tS
  
    // send desktop notification
    if(currentUser.desktop_notification == true){
      webpush.setVapidDetails(
        'mailto:support@crmgrow.com',
        config.VAPID.PUBLIC_VAPID_KEY,
        config.VAPID.PRIVATE_VAPID_KEY
      )
      
      const subscription = JSON.parse(currentUser.desktop_notification_subscription)
      const title = contact.first_name + ' watched video -' + video.title 
      const body = 'Watched ' + timeWatched + ' of ' + timeTotal + ' at ' + query['created_at']
      const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico"}})
      webpush.sendNotification(subscription, playload).catch(err => console.error(err))
    }
  
    // send text notification
    if(currentUser.text_notification == true){
      const e164Phone = phone(currentUser.cell_phone)[0]
      const fromNumber = config.TWILIO.TWILIO_NUMBER
      console.info(`Send SMS: ${fromNumber} -> ${currentUser.cell_phone}`)
      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number'
        }
        throw error // Invalid phone number
      }
    
      const title = contact.first_name + ' watched video -' + video.title + '\n'
      const body = 'Watched ' + timeWatched + ' at ' + query['created_at']
      const contact_link = urls.CONTACT_PAGE_URL + contact.id 

      twilio.messages.create({from: fromNumber, body: title+body + '\n' + contact_link,  to: e164Phone}).catch(err => console.error(err))
    }


    // send email notification
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
  
    const msg = {
      to: currentUser.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
      templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone_number: contact.cell_phone,
        email: contact.email,
        activity: contact.first_name + ' watched video - <b>' + video.title + '</b>',
        duration: 'Watched <b>' + timeWatched + ' of ' + timeTotal + ' </b>at ' + query['created_at'],
        detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "' style='text-decoration: none; color: white; font-size: 16px;'>View Contact</a>"
      },
    };
  
    sgMail.send(msg).catch(err => console.error(err))   
  }
  
  const updateVideo = async(duration, video_tracker_id) =>{
    const video_tracker = await VideoTracker.findOne({_id: video_tracker_id});
    video_tracker['duration'] = duration
    video_tracker['updated_at'] = new Date()
    video_tracker.save()
  }

const setup = (io) => {
  console.info('Setup Socket.io:')
  io.sockets
    .on('connection', (socket) => {
      socket.emit('connected')
      socket.on('init_pdf', (data)=>{
        createPDF(data).then((_pdf_tracker)=>{
          socket.type = 'pdf'
          socket.pdf_tracker = _pdf_tracker
        })
      })

      socket.on('update_pdf', (duration)=>{
        const pdf_tracker = socket.pdf_tracker
        updatePDF(duration, pdf_tracker._id)
      })

      socket.on('init_video', (data)=>{
        createVideo(data).then((_video_tracker)=>{
          socket.type = 'video'
          socket.video_tracker = _video_tracker
        })
      })

      socket.on('update_video', (duration)=>{
        const video_tracker = socket.video_tracker
        updateVideo(duration, video_tracker._id)
      })

      socket.on('disconnecting', () => {
        if(socket.type == 'pdf'){
            const pdf_tracker = socket.pdf_tracker
            disconnectPDF(pdf_tracker)
        }else if(socket.type == 'video'){
            const video_tracker = socket.video_tracker
            disconnectVideo(video_tracker)
        } 
      })
      //auth(socket)
    })
}

module.exports = {
    setup
}
