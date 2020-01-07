const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
const mime = require('mime-types')

const User = require('../models/user')
const Contact = require('../models/contact')
const Activity = require('../models/activity')
const Image = require('../models/image')
const ImageTracker = require('../models/image_tracker')
const { PREVIEW_PATH } = require('../config/path')
const urls = require('../constants/urls')
const config = require('../config/config')
const mail_contents = require('../constants/mail_contents')
const uuidv1 = require('uuid/v1')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const AWS = require('aws-sdk')
const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})
const sharp = require('sharp');

const play = async(req, res) => {  
  const image_id = req.query.image
  const sender_id = req.query.user
  const image = await Image.findOne({_id: image_id})
  const sender = await User.findOne({_id: sender_id, del: false})
 
  if(sender){
    res.render('image', {
      image: image,
      user: sender
    })
  } else {
    res.send('Sorry! This image link is expired for some reason. Please try ask to sender to send again.')
  }
  
}

const play1 = async(req, res) => {  
  const activity = await Activity.findOne({_id: req.params.id}).populate([{path:'user'}, {path:'images'}]).catch(err =>{
    console.log('err', err)
  })
  
  const data = activity['user']
  myJSON = JSON.stringify(data)
  const user = JSON.parse(myJSON);
  delete user.hash
  delete user.salt
  delete user.payment
  
  const image = activity['images']
  
  res.render('image1', {
      image: image,
      user: user,
      contact: activity['contacts'],
      activity: activity.id
  })
}

const create = async (req, res) => {
  if (req.files) {
    const files = req.files
    let url = []
    for(let i=0; i<files.length; i++){
      url.push(files[i].location)
    }
    
    const image = new Image({
      user: req.currentUser.id,
      type: files[0].mimetype,
      url: url,
      role: 'user',
      created_at: new Date()
    })
    image.save().then((data)=>{
      return res.send({
        status: true,
        data
      })
    })
  }
}

const updateDetail = async (req, res) => {
  const {currentUser} = req
  if (req.body.preview) { // base 64 image
    const editData = req.body
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.preview, PREVIEW_PATH, file_name)
    const image = await Image.findOne({user: currentUser.id, _id: req.params.id})
    
    if (!image) {
      return res.status(400).json({
        status: false,
        error: 'Invalid_permission'
      })
    }

    for (let key in editData) {
      image[key] = editData[key]
    }

    image['preview'] = urls.IMAGE_PREVIEW_URL + path.basename(file_path) 

    image['updated_at'] = new Date()

    image.save().then((data)=>{
      return res.send({
        status: true,
        data
      })
    })

  }else{
    return res.status(400).json({
      status: false,
      error: 'Not_found_preview'
    })
  }
}

const get = async (req, res) => {
  const image = await Image.findOne({_id: req.params.id}).catch(err=>{
    console.log('err', err)
  })
  const user = await User.findOne({_id: image.user}).catch(err=>{
    console.log('err', err)
  })
  if (!image) {
    return res.status(400).json({
      status: false,
      error: 'Image doesn`t exist'
    })
  }
  myJSON = JSON.stringify(image)
  const data = JSON.parse(myJSON);
  Object.assign(data, {"user": user})

  res.send({
    status: true,
    data
  })
}

const getPreview = (req, res) => {
  const filePath = PREVIEW_PATH + req.params.name
  console.info('File Path:', filePath)
  if (fs.existsSync(filePath)) {
    if(req.query.resize){
      const readStream = fs.createReadStream(filePath)
      let transform = sharp()
      transform = transform.resize(250, 140)
      return readStream.pipe(transform).pipe(res)
    }else{
      const contentType = mime.contentType(path.extname(req.params.name))
      res.set('Content-Type', contentType)
      return res.sendFile(filePath)
    }
  } else {
    res.status(404).send({
      status: false,
      error: 'Preview does not exist'
    })
  }
}

const getAll = async (req, res) => {
  const {currentUser} = req
  let _image_list = await Image.find({user: currentUser.id, del: false}).sort({created_at : 1 })
  let _image_admin = await Image.find({role: "admin", del: false}).sort({created_at : 1 })
  Array.prototype.push.apply(_image_list, _image_admin)

  if (!_image_list) {
    return res.status(400).json({
      status: false,
      error: 'Image doesn`t exist'
    })
  }
  let data = [];

  for(let i = 0; i < _image_list.length; i ++){
    // const _pdf_detail = await PDFTracker.aggregate([
    //     {
    //       $lookup:
    //         {
    //         from:  'pdfs',
    //         localField: 'pdf',
    //         foreignField: '_id',
    //         as: "pdf_detail"
    //         }
    //     },
    //     {
    //       $match: { 
    //                 "pdf": _pdf_list[i]._id,
    //                 "user": currentUser._id
    //               }
    //     }
    // ])
    
    const view = await ImageTracker.countDocuments({
      image: _image_list[i]._id,
      user: currentUser._id
    })

    myJSON = JSON.stringify(_image_list[i])
    const _image = JSON.parse(myJSON);
    const image_detail = await Object.assign(_image, {"views": view})
    data.push(image_detail)
  }

  res.send({
    status: true,
    data
  })
}

const remove = async (req, res) => {
  const { currentUser } = req
  try {
    const image = await Image.findOne({ _id: req.params.id, user: currentUser.id})
    if (image) {
      let urls =  image.url
      for(let i=0; i<urls.length; i++){
        let url = urls[i]
        s3.deleteObject({
          Bucket: config.AWS.AWS_S3_BUCKET_NAME,
          Key: url.slice(44)
        }, function (err,data){
          console.log('err', err)
        })
      }

      image['del'] = true
      image.save()

      res.send({
        status: true,
      })
    } else {
      res.status(400).send({
        status: false,
        error: 'invalid permission'
      })
    }
  } catch (e) {
    console.error(e)
    res.status(500).send({
      status: false,
      error: 'internal_server_error'
    })
  }
}

const bulkEmail = async(req, res) => {
  const { currentUser } = req
  let {content, subject, images, contacts} = req.body 
  
  if(contacts){
    if(contacts.length>15){
      return res.status(400).json({
        status: false,
        error: 'You can send max 15 contacts at a time'
      })
    }
    
    for(let i=0; i<contacts.length; i++){
      const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
        console.log('err', err)
      }) 
      let image_titles = ''
      let image_descriptions = ''
      let image_objects = ''
      let image_subject = ''
      let image_content = content
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
            content: currentUser.user_name + ' sent image using email',
            contacts: contacts[i],
            user: currentUser.id,
            type: 'images',
            images: image._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: subject,
            description: image_content
          })
          
          const activity = await _activity.save().then().catch(err=>{
            console.log('err', err)
          })
          Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
            console.log('err', err)
          })
          
          const image_link = urls.MATERIAL_VIEW_IMAGE_URL + activity.id
          
          if(images.length>=2){
            image_subject = mail_contents.IMAGE_TITLE
          }else{
            image_subject = `${image.title}`
          }
          
          if(j < images.length-1){
            image_titles = image_titles + image.title + ', '  
            image_descriptions = image_descriptions + `${image.description}, ` 
          } else{
            image_titles = image_titles + image.title
            image_descriptions = image_descriptions + image.description
          }
          const image_object = `<p style="max-width:800px;margin-top:0px;"><b>${image.title}:</b><br/>${image.description}<br/><br/><a href="${image_link}"><img src="${image.preview}?resize=true"/></a><br/></p>`
          image_objects = image_objects + image_object                      
      }
      
      if(subject == '' ){
        subject = 'Image: ' + image_subject
      } else {
        subject = subject.replace(/{image_title}/ig, image_subject)
      }
    
        if(image_content.search(/{image_object}/ig) != -1){
          image_content = image_content.replace(/{image_object}/ig, image_objects)
        }else{
          image_content = image_content+image_objects
        }
        
        if(content.search(/{image_title}/ig) != -1){
          image_content = image_content.replace(/{image_title}/ig, image_titles)
        }
        
        if(content.search(/{image_description}/ig) != -1){
          image_content = image_content.replace(/{image_description}/ig, image_descriptions)
        }
        
        const msg = {
          to: _contact.email,
          from: `${currentUser.user_name} <${currentUser.email}>`,
          subject: subject,
          html: '<html><head><title>Image Invitation</title></head><body><p style="white-space:pre-wrap;max-width:800px;margin-top:0px;">'
                +image_content+'<br/>Thank you,<br/><br/>'+ currentUser.email_signature + '</body></html>'
        }
        
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
      
        sgMail.send(msg).then((_res) => {
          console.log('mailres.errorcode', _res[0].statusCode);
          if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
            console.log('status', _res[0].statusCode)
          }else {
            console.log('email sending err', msg.to+res[0].statusCode)
          }
        }).catch ((e) => {
          console.log('email sending err', msg.to)
          console.error(e)
        })
      }
      
      return res.send({
        status: true,
      })
    }else {
      return res.status(400).json({
        status: false,
        error: 'Contacts not found'
      })
    }  
}

const bulkText = async(req, res) => {
  const { currentUser } = req
  let {content, images, contacts} = req.body 
  
  if(contacts){
    if(contacts.length>15){
      return res.status(400).json({
        status: false,
        error: 'You can send max 15 contacts at a time'
      })
    }
    
    for(let i=0; i<contacts.length; i++){
      const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
        console.log('err', err)
      }) 
      let image_titles = ''
      let image_descriptions = ''
      let image_objects = ''
      let image_content = content
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
            content: currentUser.user_name + ' sent pdf using sms',
            contacts: contacts[i],
            user: currentUser.id,
            type: 'images',
            images: image._id,
            created_at: new Date(),
            updated_at: new Date(),
            description: image_content
          })
          
          const activity = await _activity.save().then().catch(err=>{
            console.log('err', err)
          })
          Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
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
          const image_object = `${image.title}\n${image_link}\n\n`
          image_objects = image_objects + image_object                      
      }
      
      if(content.search(/{image_object}/ig) != -1){
        content = content.replace(/{image_object}/ig, image_objects)
      }else{
        content = content+'\n'+image_objects
      }
        
      if(content.search(/{image_title}/ig) != -1){
        content = content.replace(/{image_title}/ig, image_titles)
      }
        
      if(content.search(/{image_description}/ig) != -1){
        content = content.replace(/{image_description}/ig, image_descriptions)
      }
      
      const e164Phone = phone(_contact.cell_phone)[0];
      
      if (!e164Phone) {
        const error = {
          error: 'Invalid Phone Number'
        }
    
        throw error // Invalid phone number
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

      twilio.messages.create({from: fromNumber, body: image_content,  to: e164Phone}).then(()=>{
        console.info(`Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`, image_content)
      }).catch(err=>{
        console.log('err', err)
      })  
    }
    
    return res.send({
      status: true,
    })
  }else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found'
    })
  }
}

module.exports = {
  play,
  play1,
  create,
  updateDetail,
  get,
  getAll,
  getPreview,
  bulkEmail,
  bulkText,
  remove,
}