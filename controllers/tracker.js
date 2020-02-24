const User = require('../models/user')
const Contact = require('../models/contact');
const PDFTracker = require('../models/pdf_tracker');
const PDF = require('../models/pdf');
const VideoTracker = require('../models/video_tracker');
const Video = require('../models/video');
const Image = require('../models/image');
const ImageTracker = require('../models/image_tracker');
const Activity = require('../models/activity');
const TimeLineCtrl = require('./time_line');
const sgMail = require('@sendgrid/mail')
const urls = require('../constants/urls')
const mail_contents = require('../constants/mail_contents')
const config = require('../config/config')
const webpush = require('web-push');
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const moment = require('moment')

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
    const title = contact.first_name + ' ' + contact.last_name + ' - ' + contact.email +' reviewed pdf -' + pdf.title 
    const created_at =moment(query['created_at']).utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm a')
    const body = 'Watched ' + timeWatched + ' on ' + created_at
    const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico","badge": '/fav.ico'}})
    webpush.sendNotification(subscription, playload).catch(err => console.error(err))
  }

   // send text notification
   if(currentUser.text_notification == true){
    const e164Phone = phone(currentUser.cell_phone)[0]
    
    if (!e164Phone) {
      const error = {
        error: 'Invalid Phone Number'
      }
  
      throw error // Invalid phone number
    } else {
      let fromNumber = currentUser['proxy_number'];
      if(!fromNumber) {
        const areaCode = currentUser.cell_phone.substring(1, 4)
    
        const data = await twilio
        .availablePhoneNumbers('US')
        .local.list({
          areaCode: areaCode,
        })
      
        let number = data[0];
    
        if(typeof number == 'undefined'){
          const areaCode1 = currentUser.cell_phone.substring(1, 3)
    
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
          currentUser['proxy_number'] = proxy_number.phoneNumber;
          fromNumber = currentUser['proxy_number'];
          currentUser.save().catch(err=>{
            console.log('err', err)
          })
        } else {
          fromNumber = config.TWILIO.TWILIO_NUMBER
        } 
      }
    
      const title = contact.first_name + ' ' + contact.last_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n'+'\n'+' Reviewed pdf: ' + pdf.title + '\n'
      const created_at =moment(query['created_at']).utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm a')
      const body = 'Watched ' + timeWatched + ' on ' + created_at + '\n '
      const contact_link = urls.CONTACT_PAGE_URL + contact.id 
      twilio.messages.create({from: fromNumber, body: title+'\n'+body + '\n'+contact_link,  to: e164Phone}).catch(err=>{
        console.log('send sms err: ',err)
      })
    } 
  }

  // send email notification
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const created_at = moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm:ss a')
  const msg = {
    to: currentUser.email,
    from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
    subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
    templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
    dynamic_template_data: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
      email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
      activity: contact.first_name + ' reviewed pdf - <b>' + pdf.title + '</b>',
      duration: 'Watched <b>' + timeWatched + ' </b>at ' + created_at,
      detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
    },
  };

  sgMail.send(msg).then().catch(err=>{
    console.log('send message err: ',err)
  })


  const timelines = await TimeLine.find({ 
    contact: query['contact'],
    status:  {$in:[ "pending", "active" ]},
    'action.pdf': query['pdf'],
    'condition.type': 'watched_pdf',
    'condition.answer': true,
  }).catch(err=>{
    console.log('err', err)
  })
  
  if(timelines.length>0){
    for(let i=0; i<timelines.lengh; i++){
      try{
        const timeline = timelines[i]
        TimeLineCtrl.runTimeline(timeline.id)
        const period = timeline['period']
        timeline['status'] = 'completed'
        timeline.save().catch(err=>{
          console.log('err', err)
        })
        let now = moment()
        let due_date = now.add(period, 'hours');
        due_date.set({minute:0,second:0,millisecond:0})
        const data = {
          contact: query['contact'],
          ref: timeline.ref,
          due_date: due_date
        }
        TimeLineCtrl.activeNext(data).catch(err=>{
          console.log('err', err)
        })
      }catch(err){
        console.log('err', err)
      }
    }
  }
  const unwatched_timelines = await TimeLine.find({ 
    contact: query['contact'],
    status:  {$in:[ "pending", "active" ]},
    'action.pdf': query['pdf'],
    'condition.type': 'watched_pdf',
    'condition.answer': false,
  }).catch(err=>{
    console.log('err', err)
  })
  if(unwatched_timelines.length>0){
    for(let i=0; i<unwatched_timelines; i++){
      const timeline = unwatched_timelines[i]
      timeline['status'] = 'disable'
      timeline.save().catch(err=>{
        console.log('err', err)
      })
    }
  }
  

    const activity = new Activity({
      content: contact.first_name + ' reviewed pdf',
      contacts: query.contact,
      user: currentUser.id,
      type: 'pdf_trackers',
      pdf_trackers: query.id,
      pdfs: pdf.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      Contact.findByIdAndUpdate(query.contact,{ $set: {last_activity: _activity.id} }).catch(err=>{
        console.log('err', err)
      })
    }).catch(err=>{
      console.log('err', err)
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
      content: 'watched video',
      contacts: query.contact,
      user: currentUser.id,
      type: 'video_trackers',
      video_trackers: query.id,
      videos: video.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      Contact.findByIdAndUpdate(query.contact,{ $set: {last_activity: _activity.id} }).catch(err=>{
        console.log('err', err)
      })
    }).catch(err=>{
      console.log('err', err)
    })

    const timelines = await TimeLine.find({ 
      contact: query['contact'],
      status:  {$in:[ "pending", "active" ]},
      'watched_video': query['video'],
      'condition.type': 'watched_video',
      'condition.answer': true,
    }).catch(err=>{
      console.log('err', err)
    })
    
    if(timelines.length>0){
      for(let i=0; i<timelines.lengh; i++){
        try{
          const timeline = timelines[i]
          TimeLineCtrl.runTimeline(timeline.id)
          const period = timeline['period']
          timeline['status'] = 'completed'
          timeline.save().catch(err=>{
            console.log('err', err)
          })
          let now = moment()
          let due_date = now.add(period, 'hours');
          due_date.set({minute:0,second:0,millisecond:0})
          const data = {
            contact: query['contact'],
            ref: timeline.ref,
            due_date: due_date
          }
          TimeLineCtrl.activeNext(data).catch(err=>{
            console.log('err', err)
          })
        }catch(err){
          console.log('err', err)
        }
      }
    }
    const unwatched_timelines = await TimeLine.find({ 
      contact: query['contact'],
      status:  {$in:[ "pending", "active" ]},
      'watched_video': query['video'],
      'condition.type': 'watched_video',
      'condition.answer': false,
    }).catch(err=>{
      console.log('err', err)
    })
    if(unwatched_timelines.length>0){
      for(let i=0; i<unwatched_timelines; i++){
        const timeline = unwatched_timelines[i]
        timeline['status'] = 'disable'
        timeline.save().catch(err=>{
          console.log('err', err)
        })
      }
    }
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
      const title = contact.first_name + ' ' + contact.last_name +  ' - ' + contact.email + ' watched video -' + video.title 
      const created_at = moment(query['created_at']).utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm a')
      const body = 'Watched ' + timeWatched + ' of ' + timeTotal + ' on ' + created_at
      const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico","badge": '/fav.ico'}})
      webpush.sendNotification(subscription, playload).catch(err => console.error(err))
    }
  
    // send text notification
    if(currentUser.text_notification == true && currentUser.cell_phone){
      const e164Phone = phone(currentUser.cell_phone)[0]
      
      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number'
        }
        throw error // Invalid phone number
      } else {
      
        let fromNumber = currentUser['proxy_number'];
        if(!fromNumber) {
          const areaCode = currentUser.cell_phone.substring(1, 4)
      
          const data = await twilio
          .availablePhoneNumbers('US')
          .local.list({
            areaCode: areaCode,
          })
        
          let number = data[0];
      
          if(typeof number == 'undefined'){
            const areaCode1 = currentUser.cell_phone.substring(1, 3)
      
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
            currentUser['proxy_number'] = proxy_number.phoneNumber;
            fromNumber = currentUser['proxy_number'];
            currentUser.save().catch(err=>{
              console.log('err', err)
            })
          } else {
            fromNumber = config.TWILIO.TWILIO_NUMBER
          } 
        }
        
        const title = contact.first_name + ' ' + contact.last_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n' +'\n'+ ' Watched video:' + video.title + '\n'
        const created_at =moment(query['created_at']).utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm a')
        const body = 'Watched ' + timeWatched + ' of ' + timeTotal + ' on ' + created_at
        const contact_link = urls.CONTACT_PAGE_URL + contact.id 
  
        twilio.messages.create({from: fromNumber, body: title+'\n'+body + '\n' + contact_link,  to: e164Phone}).catch(err => console.error(err))
      }
    }

    // send email notification
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
    const created_at = moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm: a')

    const msg = {
      to: currentUser.email,
      from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
      subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
      templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
      dynamic_template_data: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
        email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
        activity: contact.first_name + ' watched video - <b>' + video.title + '</b>',
        duration: 'Watched <b>' + timeWatched + ' of ' + timeTotal + ' </b>at ' + created_at,
        detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
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

  const createImage = async(data) => {
    const image_tracker = new ImageTracker({
      ...data,
      updated_at: new Date(),
      created_at: new Date(),
    })
    
    return await image_tracker.save()
  }

  const disconnectImage = async(image_tracker_id) =>{
    const query = await ImageTracker.findOne({_id: image_tracker_id})
    const currentUser = await User.findOne({_id: query['user']})
    const contact = await Contact.findOne({_id: query['contact']})
    const image = await Image.findOne({_id: query['image']})
  
    const activity = new Activity({
      content: contact.first_name + ' reviewed image',
      contacts: query.contact,
      user: currentUser.id,
      type: 'image_trackers',
      image_trackers: query.id,
      images: image.id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    activity.save().then(_activity => {
      Contact.findByIdAndUpdate(query.contact,{ $set: {last_activity: _activity.id} }).catch(err=>{
        console.log('err', err)
      })
    }).catch(err=>{
      console.log('err', err)
    })

    const timelines = await TimeLine.find({ 
      contact: query['contact'],
      status:  {$in:[ "pending", "active" ]},
      'action.pdf': query['pdf'],
      'condition.type': 'watched_image',
      'condition.answer': true,
    }).catch(err=>{
      console.log('err', err)
    })
    
    if(timelines.length>0){
      for(let i=0; i<timelines.lengh; i++){
        try{
          const timeline = timelines[i]
          TimeLineCtrl.runTimeline(timeline.id)
          const period = timeline['period']
          timeline['status'] = 'completed'
          timeline.save().catch(err=>{
            console.log('err', err)
          })
          let now = moment()
          let due_date = now.add(period, 'hours');
          due_date.set({minute:0,second:0,millisecond:0})
          const data = {
            contact: query['contact'],
            ref: timeline.ref,
            due_date: due_date
          }
          TimeLineCtrl.activeNext(data).catch(err=>{
            console.log('err', err)
          })
        }catch(err){
          console.log('err', err)
        }
      }
    }
    const unwatched_timelines = await TimeLine.find({ 
      contact: query['contact'],
      status:  {$in:[ "pending", "active" ]},
      'action.image': query['image'],
      'condition.type': 'watched_image',
      'condition.answer': false,
    }).catch(err=>{
      console.log('err', err)
    })
    if(unwatched_timelines.length>0){
      for(let i=0; i<unwatched_timelines; i++){
        const timeline = unwatched_timelines[i]
        timeline['status'] = 'disable'
        timeline.save().catch(err=>{
          console.log('err', err)
        })
      }
    }
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
    const title = contact.first_name + ' ' + contact.last_name + ' - ' + contact.email +' reviewed image -' + image.title 
    const created_at =moment(query['created_at']).utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm a')
    const body = 'Watched ' + timeWatched + ' on ' + created_at
    const playload = JSON.stringify({notification: {"title":title, "body":body, "icon": "/fav.ico","badge": '/fav.ico'}})
    webpush.sendNotification(subscription, playload).catch(err => console.error(err))
  }

   // send text notification
   if(currentUser.text_notification == true){
    const e164Phone = phone(currentUser.cell_phone)[0]
    
    if (!e164Phone) {
      const error = {
        error: 'Invalid Phone Number'
      }
  
      throw error // Invalid phone number
    } else {
      let fromNumber = currentUser['proxy_number'];
      if(!fromNumber) {
        const areaCode = currentUser.cell_phone.substring(1, 4)
    
        const data = await twilio
        .availablePhoneNumbers('US')
        .local.list({
          areaCode: areaCode,
        })
      
        let number = data[0];
    
        if(typeof number == 'undefined'){
          const areaCode1 = currentUser.cell_phone.substring(1, 3)
    
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
          currentUser['proxy_number'] = proxy_number.phoneNumber;
          fromNumber = currentUser['proxy_number'];
          currentUser.save().catch(err=>{
            console.log('err', err)
          })
        } else {
          fromNumber = config.TWILIO.TWILIO_NUMBER
        } 
      }
    
      const title = contact.first_name + ' ' + contact.last_name +  '\n' + contact.email +  '\n' + contact.cell_phone + '\n'+'\n'+' Reviewed image: ' + image.title + '\n'
      const created_at =moment(query['created_at']).utcOffset(currentUser.time_zone).format('MM/DD/YYYY') + ' at ' + moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm a')
      const body = 'Watched ' + timeWatched + ' on ' + created_at + '\n '
      const contact_link = urls.CONTACT_PAGE_URL + contact.id 
      twilio.messages.create({from: fromNumber, body: title+'\n'+body + '\n'+contact_link,  to: e164Phone}).catch(err=>{
        console.log('send sms err: ',err)
      })
    } 
  }

  // send email notification
  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  const created_at = moment(query['created_at']).utcOffset(currentUser.time_zone).format('h:mm:ss a')
  const msg = {
    to: currentUser.email,
    from: mail_contents.NOTIFICATION_SEND_MATERIAL.MAIL,
    subject: mail_contents.NOTIFICATION_SEND_MATERIAL.SUBJECT,
    templateId: config.SENDGRID.SENDGRID_NOTICATION_TEMPLATE,
    dynamic_template_data: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone_number: `<a href="tel:${contact.cell_phone}">${contact.cell_phone}</a>`,
      email: `<a href="mailto:${contact.email}">${contact.email}</a>`,
      activity: contact.first_name + ' reviewed image - <b>' + image.title + '</b>',
      duration: 'Watched <b>' + timeWatched + ' </b>at ' + created_at,
      detailed_activity: "<a href='" + urls.CONTACT_PAGE_URL + contact.id + "'><img src='"+urls.DOMAIN_URL+"assets/images/contact.png'/></a>"
    },
  };

  sgMail.send(msg).then().catch(err=>{
    console.log('send message err: ',err)
  })
}

const updateImage = async(duration, image_tracker_id) =>{
  const image_tracker = await ImageTracker.findOne({_id: image_tracker_id});
  image_tracker['duration'] = duration
  image_tracker['updated_at'] = new Date()
  image_tracker.save()
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
        if(typeof pdf_tracker != 'undefined'){
          updatePDF(duration, pdf_tracker._id).catch(err=>{
            console.log('err', err)
          })
        }
      })

      socket.on('init_video', (data)=>{
        createVideo(data).then((_video_tracker)=>{
          socket.type = 'video'
          socket.video_tracker = _video_tracker
        })
      })

      socket.on('update_video', (duration)=>{
        const video_tracker = socket.video_tracker
        if(typeof video_tracker != 'undefined'){
          updateVideo(duration, video_tracker._id).then(()=>{
          }).catch(err=>{
            console.log('err', err)
          })
        }
      })

      socket.on('init_image', (data)=>{
        createImage(data).then((_image_tracker)=>{
          socket.type = 'image'
          socket.image_tracker = _image_tracker
        })
      })
      
      socket.on('update_image', (duration)=>{
        const image_tracker = socket.image_tracker
        if(typeof image_tracker != 'undefined'){
          updateImage(duration, image_tracker._id).then(()=>{
          }).catch(err=>{
            console.log('err', err)
          })
        }
      })
      
      socket.on('disconnect', () => {
        if(socket.type == 'pdf'){
          console.log("PDF_disconnecting");
          const pdf_tracker = socket.pdf_tracker
          if( !socket.pdf_tracker.viewed ){
            console.log("PDF disconnected");
            disconnectPDF(pdf_tracker._id)
          }            
        }else if(socket.type == 'video'){
          console.log('video_disconnecting');
          const video_tracker = socket.video_tracker
          if( !socket.video_tracker.viewed ){
            console.log("disconnected");
            disconnectVideo(video_tracker._id)
          }            
        }else if(socket.type == 'image'){
          console.log('image_disconnecting');
          const image_tracker = socket.image_tracker
          if( !socket.image_tracker.viewed ){
            console.log("disconnected");
            console.log('image_tracker', image_tracker)
            disconnectImage(image_tracker._id)
          }
        }
      })

      socket.on('close', () => {
        if(socket.type == 'pdf'){
          console.log('disconnecting with full view')  
          const pdf_tracker = socket.pdf_tracker
          socket.pdf_tracker.viewed = true
          disconnectPDF(pdf_tracker._id)
        }else if(socket.type == 'video'){
          console.log('disconnecting with full view')
          const video_tracker = socket.video_tracker
          socket.video_tracker.viewed = true
          disconnectVideo(video_tracker._id)
        }else if(socket.type == 'image'){
          console.log('disconnectiong with full view')
          const image_tracker = socket.image_tracker
          socket.image_tracker.viewed = true
          disconnectImage(image_tracker._id)
        } 
      })
      //auth(socket)
    })
}

module.exports = {
    setup
}
