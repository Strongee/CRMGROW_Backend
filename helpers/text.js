const User = require('../models/user')
const Contact = require('../models/contact')
const config = require('../config/config')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const urls = require('../constants/urls')

const bulkVideo = async(data) => {
  let {user, content, videos, contacts} = data 
  const currentUser = await User.findOne({_id: user}).catch(err=>{
    console.log('err', err)
  })
  let promise_array = []

  for(let i=0; i<contacts.length; i++){
    const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
      console.log('err', err)
    }) 
    let video_titles = ''
    let video_descriptions = ''
    let video_objects = ''
    let video_content = content
    let activity
    for(let j=0; j<videos.length; j++){
      const video = videos[j]           
          
      if(typeof video_content == 'undefined'){
        video_content = ''
      }
      
      video_content = video_content.replace(/{user_name}/ig, currentUser.user_name)
        .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
        .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
        .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
      const _activity = new Activity({
        content: 'sent video using sms',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'videos',
        videos: video._id,
        created_at: new Date(),
        updated_at: new Date(),
        description: video_content
      })
          
      activity = await _activity.save().then().catch(err=>{
        console.log('err', err)
      })
          
      const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id
        
      if(j < videos.length-1){
        video_titles = video_titles + video.title + ', '  
        video_descriptions = video_descriptions + `${video.description}, ` 
      } else{
        video_titles = video_titles + video.title
        video_descriptions = video_descriptions + video.description
      }
      const video_object = `\n${video.title}:\n\n${video_link}\n`
      video_objects = video_objects + video_object                      
    }
      
    if(video_content.search(/{video_object}/ig) != -1){
      video_content = video_content.replace(/{video_object}/ig, video_objects)
    }else{
      video_content = video_content+'\n'+video_objects
    }
        
    if(video_content.search(/{video_title}/ig) != -1){
      video_content = video_content.replace(/{video_title}/ig, video_titles)
    }
        
    if(video_content.search(/{video_description}/ig) != -1){
      video_content = video_content.replace(/{video_description}/ig, video_descriptions)
    }
      
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
          
        currentUser['proxy_number'] = proxy_number.phoneNumber;
        fromNumber = currentUser['proxy_number'];
        currentUser.save().catch(err=>{
          console.log('err', err)
        })
      } else {
        fromNumber = config.TWILIO.TWILIO_NUMBER
      } 
    }

    const promise = new Promise((resolve, reject) =>{
      const e164Phone = phone(_contact.cell_phone)[0];
      
      if (!e164Phone) {
        Activity.deleteOne({_id: activity.id}).catch(err=>{
          console.log('err', err)
        })
        resolve({
          contact: contacts[i],
          error: err,
          status: false
        }) // Invalid phone number
      }
      twilio.messages.create({from: fromNumber, body: video_content,  to: e164Phone}).then(()=>{
        console.info(`Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`, video_content)
        Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
          console.log('err', err)
        })
        resolve({
          status: true
        }) 
      }).catch(err=>{
        console.log('err', err)
        Activity.deleteOne({_id: activity.id}).catch(err=>{
          console.log('err', err)
        })
        resolve({
          contact: contacts[i],
          error: err,
          status: false
        })
      })  
    })
    promise_array.push(promise)
  }
    
  return Promise.all(promise_array)
}

const bulkPdf  = async(data) => {
  let {user, content, pdfs, contacts} = data 
  const currentUser = await User.findOne({_id: user}).catch(err=>{
    console.log('err', err)
  })
  let promise_array = []
    
  for(let i=0; i<contacts.length; i++){
    const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
      console.log('err', err)
    }) 
    let pdf_titles = ''
    let pdf_descriptions = ''
    let pdf_objects = ''
    let pdf_content = content
    let activity
      
    for(let j=0; j<pdfs.length; j++){
      const pdf = pdfs[j]        
          
      if(!pdf_content){
        pdf_content = ''
      }
      
      pdf_content = pdf_content.replace(/{user_name}/ig, currentUser.user_name)
        .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
        .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
        .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
      const _activity = new Activity({
        content: 'sent pdf using sms',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'pdfs',
        pdfs: pdf._id,
        created_at: new Date(),
        updated_at: new Date(),
        description: pdf_content
      })
          
      activity = await _activity.save().then().catch(err=>{
        console.log('err', err)
      })
          
      const pdf_link = urls.MATERIAL_VIEW_PDF_URL + activity.id
      
      if(j < pdfs.length-1){
        pdf_titles = pdf_titles + pdf.title + ', '  
        pdf_descriptions = pdf_descriptions + `${pdf.description}, ` 
      } else{
        pdf_titles = pdf_titles + pdf.title
        pdf_descriptions = pdf_descriptions + pdf.description
      }
      const pdf_object = `\n${pdf.title}:\n\n${pdf_link}\n`
        pdf_objects = pdf_objects + pdf_object                      
      }
      
      if(pdf_content.search(/{pdf_object}/ig) != -1){
        pdf_content = pdf_content.replace(/{pdf_object}/ig, pdf_objects)
      }else{
        pdf_content = pdf_content+'\n'+pdf_objects
      }
        
      if(pdf_content.search(/{pdf_title}/ig) != -1){
        pdf_content = pdf_content.replace(/{pdf_title}/ig, pdf_titles)
      }
        
      if(pdf_content.search(/{pdf_description}/ig) != -1){
        pdf_content = pdf_content.replace(/{pdf_description}/ig, pdf_descriptions)
      }
      
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
          
          currentUser['proxy_number'] = proxy_number.phoneNumber;
          fromNumber = currentUser['proxy_number'];
          currentUser.save().catch(err=>{
            console.log('err', err)
          })
        } else {
          fromNumber = config.TWILIO.TWILIO_NUMBER
        } 
      }

      const promise = new Promise((resolve, reject) =>{
        const e164Phone = phone(_contact.cell_phone)[0];
      
        if (!e164Phone) {
          Activity.deleteOne({_id: activity.id}).catch(err=>{
            console.log('err', err)
          })
          resolve({
            status: false,
            error: err,
            contact: contacts[i]
          }) // Invalid phone number
        }
        twilio.messages.create({from: fromNumber, body: pdf_content,  to: e164Phone}).then(()=>{
          console.info(`Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`, pdf_content)
          Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
            console.log('err', err)
          })
          resolve({
            status: true
          })
        }).catch(err=>{
          console.log('err', err)
          Activity.deleteOne({_id: activity.id}).catch(err=>{
            console.log('err', err)
          })
          resolve({
            status: false,
            error: err,
            contact: contacts[i]
          })
        })  
      })
      promise_array.push(promise)
    }
    
    Promise.all(promise_array)
}

const bulkImage = async(data) => {
  let {user, content, images, contacts} = data 
  const currentUser = await User.findOne({_id: user}).catch(err=>{
    console.log('err', err)
  })
  let promise_array = []
  let error = []
    
  for(let i=0; i<contacts.length; i++){
    const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
      console.log('err', err)
    }) 
    let image_titles = ''
    let image_descriptions = ''
    let image_objects = ''
    let image_content = content
    let activity
    for(let j=0; j<images.length; j++){
      const image = images[j]        
      
      if(!image_content){
        image_content = ''
      }
      
      image_content = image_content.replace(/{user_name}/ig, currentUser.user_name)
        .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
        .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
        .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
      
      const _activity = new Activity({
        content: 'sent image using sms',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'images',
        images: image._id,
        created_at: new Date(),
        updated_at: new Date(),
      })

      activity = await _activity.save().then().catch(err=>{
        console.log('err', err)
      })
      
      const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id
      
      if(j < images.length-1){
        image_titles = image_titles + image.title + ', '  
        image_descriptions = image_descriptions + `${image.description}, ` 
      } else{
        image_titles = image_titles + image.title
        image_descriptions = image_descriptions + image.description
      }
      const image_object = `\n${image.title}:\n\n${image_link}\n`
      image_objects = image_objects + image_object                      
    }
      
    if(image_content.search(/{image_object}/ig) != -1){
      image_content = image_content.replace(/{image_object}/ig, image_objects)
    }else{
      image_content = image_content+'\n'+image_objects
    }
        
    if(image_content.search(/{image_title}/ig) != -1){
      image_content = image_content.replace(/{image_title}/ig, image_titles)
    }
        
    if(image_content.search(/{image_description}/ig) != -1){
      image_content = image_content.replace(/{image_description}/ig, image_descriptions)
    }
      
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
          
        currentUser['proxy_number'] = proxy_number.phoneNumber;
        fromNumber = currentUser['proxy_number'];
        currentUser.save().catch(err=>{
          console.log('err', err)
        })
      } else {
        fromNumber = config.TWILIO.TWILIO_NUMBER
      } 
    }

    const promise = new Promise((resolve, reject) =>{
      const e164Phone = phone(_contact.cell_phone)[0];
      
      if (!e164Phone) {
        Activity.deleteOne({_id: activity.id}).catch(err=>{
          console.log('err', err)
        })
        resolve({
          status: false,
          contact: contacts[i],
          error: err
        }) 
      }
      twilio.messages.create({from: fromNumber, body: image_content,  to: e164Phone}).then(()=>{
        console.info(`Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`, image_content)
        Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
          console.log('err', err)
        })
        resolve({
          status: true
        })
      }).catch(err=>{
        console.log('err', err)
        Activity.deleteOne({_id: activity.id}).catch(err=>{
          console.log('err', err)
        })
          resolve({
            status: false,
            contact: contacts[i],
            error: err
          })
        })  
      })
      promise_array.push(promise)
    }
    
    return Promise.all(promise_array)
}

module.exports = {
  bulkVideo,
  bulkPdf,
  bulkImage
}