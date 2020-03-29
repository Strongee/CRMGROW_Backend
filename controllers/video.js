const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
const mime = require('mime-types')

const User = require('../models/user')
const Activity = require('../models/activity')
const Video = require('../models/video')
const VideoTracker = require('../models/video_tracker')
const Garbage = require('../models/garbage')
const Contact = require('../models/contact')
const { THUMBNAILS_PATH, TEMP_PATH, GIF_PATH } = require('../config/path')
const urls = require('../constants/urls')
const config = require('../config/config')
const mail_contents = require('../constants/mail_contents')

const uuidv1 = require('uuid/v1')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const AWS = require('aws-sdk')
const GIFEncoder = require('gifencoder');

const extractFrames = require('ffmpeg-extract-frames')
const { createCanvas, loadImage } = require('canvas')
const pngFileStream = require('png-file-stream')
const sharp = require('sharp')

const garbageHelper = require('../helpers/garbage.js')

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const nodemailer = require("nodemailer");
const credentials = {
  clientID: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: config.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token'
}
const oauth2 = require('simple-oauth2')(credentials)
const graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const { google } = require('googleapis');
const Base64 = require('js-base64').Base64;
const request = require('request-promise')
const createBody = require('gmail-api-create-message-body')

const play = async(req, res) => {  
  const video_id = req.query.video
  const sender_id = req.query.user
  const video = await Video.findOne({_id: video_id}).catch(err=>{
    console.log('err', err)
  })
  const user = await User.findOne({_id: sender_id, del: false}).catch(err=>{
    console.log('err', err)
  })

  let capture_dialog = false;

  if(user){
    const garbage = await Garbage.findOne({user: user._id}).catch(err => {
      console.log('err', err)
    })
    
    if(garbage) {
      capture_dialog = garbage['capture_dialog']
    }  
    
    let pattern = /^((http|https|ftp):\/\/)/;
    
    if(!pattern.test(user.learn_more)) {
        user.learn_more = "http://" + user.learn_more;
    }
    res.render('video', {
      video: video,
      user: user,
      capture_dialog: capture_dialog
    })
  } else {
    res.send('Sorry! This video link is expired for some reason. Please try ask to sender to send again.')
  }
}

const play1 = async(req, res) => { 
  const activity = await Activity.findOne({_id: req.params.id}).populate([{path:'user'}, {path:'videos'}]).catch(err =>{
    console.log('err', err)
  })
  
  if(activity){
    const data = activity['user']
    myJSON = JSON.stringify(data)
    const user = JSON.parse(myJSON);
    delete user.hash
    delete user.salt
    delete user.payment
    
    const video = activity['videos']
    
    let pattern = /^((http|https|ftp):\/\/)/;
    
    if(!pattern.test(user.learn_more)) {
        user.learn_more = "http://" + user.learn_more;
    }
    return res.render('video1', {
        video: video,
        user: user,
        contact: activity['contacts'],
        activity: activity.id
    })
  }else{
    return res.send('Sorry! This video link is expired for some reason. Please try ask to sender to send again.')
  }
}

const embedPlay = async(req, res) => {
  const video = await Video.findOne({_id: req.params.video});
  res.render('embedVideo', {
    video: video
  })
}

const pipe = async(req, res) =>{
  const filePath = TEMP_PATH + req.params.name
  console.info('File Path:', filePath)
  if (fs.existsSync(filePath)) {
    const contentType = mime.contentType(path.extname(req.params.name))
    res.set('Content-Type', contentType)
    res.sendFile(filePath)
  } else {
    res.status(404).send({
      status: false,
      error: 'File does not exist'
    })
  }
}

const create = async (req, res) => {
  if (req.file) {
    const file_name = req.file.filename
    
    const video = new Video({
      user: req.currentUser.id,
      url: urls.VIDEO_URL+file_name,
      type: req.file.mimetype,
      path: req.file.path,
      created_at: new Date()
    })

    const _video = await video.save().then().catch(err=>{
      console.log('err', err)
    })
    res.send({
      status: true,
      data: _video
    })
  }
}

const createVideo = async (req, res) => {
  const video = new Video({
  ...req.body, 
  user: req.currentUser.id,
  created_at: new Date()
  });

  const _video = await video.save().then().catch(err=>{
    console.log('err', err)
  })

  res.send({
    status: true,
    data: _video
  })
}

const updateDetail = async (req, res) => {
  const editData = req.body
  let thumbnail;
  let { currentUser } = req
  if (req.body.thumbnail) { // base 64 image    
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
    thumbnail = urls.VIDEO_THUMBNAIL_URL + path.basename(file_path)
  }
  
  const video = await Video.findOne({_id: req.params.id, user: currentUser.id}).catch(err=>{
    console.log('err', err)
  })

  if (!video) {
    return res.status(400).json({
      status: false,
      error: 'Invalid_permission'
    })
  }

  for (let key in editData) {
    video[key] = editData[key]
  }
  if( thumbnail ){
    video['thumbnail'] = thumbnail
  }
  
  if(video['path'] && !video['preview']){
    const file_path = video['path']
    video['preview'] = await generatePreview(file_path).catch(err=>{
      console.log('err', err)
    })
  }
  
  video['updated_at'] = new Date()
  video.save().then((_video)=>{
    res.send({
      status: true,
      data: _video
    })
  }).catch(err=>{
    console.log('err', err)
  })
}

const updateDefault = async (req, res) => {
  const {video, id} = req.body
  let thumbnail;
  let { currentUser } = req
  if (video.thumbnail) { // base 64 image    
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
    thumbnail = urls.VIDEO_THUMBNAIL_URL + path.basename(file_path)
  }  
  const defaultVideo = await Video.findOne({_id: id, role: 'admin'}).catch(err=>{
    console.log('err', err)
  })
  if (!defaultVideo) {
    return res.status(400).json({
      status: false,
      error: 'This Default video not exists'
    })
  }
  // Update Garbage
  const garbage = await garbageHelper.get(currentUser);
  if(!garbage) {
    return res.status(500).send({
      status: false,
      error: `Couldn't get the Garbage`
    })
  }
  if(garbage['edited_video']) {
    garbage['edited_video'].push(id);
  }
  else {
    garbage['edited_video'] = [id]
  }
  
  await garbage.save().catch(err => {
    return res.status.json({
      status: false,
      error: 'Update Garbage Error.'
    })
  })

  for (let key in video) {
    defaultVideo[key] = video[key]
  }
  if( thumbnail ){
    defaultVideo['thumbnail'] = thumbnail
  }
  
  if(!defaultVideo['preview']){
    const file_path = defaultVideo['path']
    defaultVideo['preview'] = await generatePreview(file_path).catch(err=>{
      console.log('err', err)
    })
  }
  
  defaultVideo['updated_at'] = new Date()
  const defaultVideoJSON = JSON.parse(JSON.stringify(defaultVideo))
  delete defaultVideoJSON['_id'];
  delete defaultVideoJSON['role'];
  let newVideo = new Video({
    ...defaultVideoJSON,
    user: currentUser._id,
    default_edited: true
  })
  const _video = await newVideo.save().then().catch(err=>{
    console.log('err', err)
  })  
  
  res.send({
    status: true,
    data: _video
  })
}

const generatePreview = async(file_path) => {

  return new Promise(async(resolve, reject) => {    
    let offsets = []
    for(let i=0; i<4000; i+=100){
      offsets.push(i);
    }
    
    await extractFrames({
      input: file_path,
      output: GIF_PATH+'screenshot-%i.jpg',
      offsets: offsets
    }).catch(err=>{
      console.log('err', err)
    });  
    
    const play = await loadImage(GIF_PATH+'play-button.png');
    
    const canvas = createCanvas(250, 140)
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(250, 140);
    
    for(let i=1; i<40; i++){
      image = await loadImage(GIF_PATH+`screenshot-${i}.jpg`);
      
      let height = image.height;
      let width = image.width;
      if(height > width) {
        ctx.rect(0, 0, 250, 140);
        ctx.fillStyle = '#000000';
        ctx.fill();
        width = 140*width/height;
        height = 140;
        ctx.drawImage(image, (250-width)/2, 0, width, height);
      } else {
        height = 140;
        width = 250;
        ctx.drawImage(image, 0, 0, width, height);
      }
      ctx.rect(60, 100, 150, 30);
      ctx.globalAlpha  = 0.7;
      ctx.fillStyle = '#333';
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.font = '20px Impact'
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Play a video', 70, 120)
      ctx.drawImage(play, 10, 95, 40, 40)
      let buf = canvas.toBuffer();
      fs.writeFileSync(GIF_PATH+`frame-${i}.png`, buf)
    }
    const file_name = uuidv1()
    const stream = pngFileStream(GIF_PATH+'frame-??.png')
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 100, quality: 10 }))
      .pipe(fs.createWriteStream(GIF_PATH+file_name));

      stream.on('finish', () => {
        if (fs.existsSync(GIF_PATH+file_name)) {
          fs.readFile(GIF_PATH+file_name, (err, data) => {
            if (err) throw err;
            console.log('File read was successful', data)
            const today = new Date()
            const year = today.getYear()
            const month = today.getMonth()
            const params = {
                Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
                Key: 'gif' +  year + '/' + month + '/' + file_name, 
                Body: data,
                ACL: 'public-read'
            };
            s3.upload(params, async (s3Err, upload)=>{
              if (s3Err) throw s3Err
              console.log(`File uploaded successfully at ${upload.Location}`)
              
              fs.unlinkSync(GIF_PATH+file_name)
              resolve(upload.Location)
            })
         });}   
      });
      stream.on('error', err=>{
        console.log('err', err)
        reject(err)
      });
    });
}

const get = async (req, res) => {
  const video = await Video.findOne({_id: req.params.id, del: false})
  const user = await User.findOne({_id: video.user})
    if (!video) {
      return res.status(400).json({
        status: false,
        error: 'Video doesn`t exist'
      })
    }
    myJSON = JSON.stringify(video)
    const data = JSON.parse(myJSON);
    Object.assign(data, {"user": user})

  res.send({
    status: true,
    data
  })

}

const getThumbnail = (req, res) => {
  const filePath = THUMBNAILS_PATH + req.params.name
  
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
    return res.status(404).send({
      status: false,
      error: 'Thumbnail does not exist'
    })
  }
}

const getAll = async (req, res) => {
  const {currentUser} = req
  const garbage = await garbageHelper.get(currentUser);
  let editedVideos = [];
  if(garbage) {
    editedVideos = garbage['edited_video']
  }

  let _video_list = await Video.find({user: currentUser.id, del: false}).sort({priority: 1}).sort({created_at : 1 })
  let _video_admin = await Video.find({role: "admin", del: false, _id: {$nin: editedVideos}}).sort({priority: 1}).sort({created_at : 1 })
  Array.prototype.push.apply(_video_list, _video_admin)

  if (!_video_list) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist'
    })
  }
  let _video_detail_list = []

  for(let i = 0; i < _video_list.length; i ++){
    const _video_detail = await VideoTracker.aggregate([
        {
          $lookup:
            {
            from:  'videos',
            localField: 'video',
            foreignField: '_id',
            as: "video_detail"
            }
        },
        {
          $match: { 
                    "video": _video_list[i]._id,
                    "user": currentUser._id
                  }
        }
    ])

    myJSON = JSON.stringify(_video_list[i])
    const _video = JSON.parse(myJSON);
    const video_detail = await Object.assign(_video, {"views": _video_detail.length})
    _video_detail_list.push(video_detail)
  }

  res.send({
    status: true,
    data: _video_detail_list
  })
}

const remove = async (req, res) => {
  const { currentUser } = req
    try {
      const video = await Video.findOne({ _id: req.params.id, user: currentUser.id})
 
      if (video) {
        if(video['default_edited']) {
          return res.status(400).send({
            status: false,
            error: 'invalid permission'
          })
        }

        let url =  video.url
        s3.deleteObject({
          Bucket: config.AWS.AWS_S3_BUCKET_NAME,
          Key: url.slice(44)
        }, function (err,data){
          console.log('err', err)
        })

        video['del'] = true
        video.save()

        return res.send({
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

const getHistory = async(req, res) => {
  const { currentUser } = req
  const _activity_list = await Activity.aggregate([
    {
      $lookup:
        {
        from:  'contacts',
        localField: 'contacts',
        foreignField: '_id',
        as: "video_detail"
        }
    },
    {
      $match: { "video": req.params.id, "user": currentUser.id}
    }
  ])
  for(let i = 0; i < _activity_list.length; i ++){
    const _video_tracker = VideoTracker.find({contact: _activity_list[i].contact, video: req.params.id, user: currentUser.id})
    _activity_list[i].video_tracker = _video_tracker;
  }
  if (_activity_list) {
    res.send({
      status: true,
      data: {
        data: _activity_list
      }
    })
  } else {
    res.status(404).send({
      status: false,
      error: 'Activity not found'
    })
  }
}

const bulkEmail = async(req, res) => {
  const { currentUser } = req
  let {content, subject, videos, contacts} = req.body 
  let promise_array = []
  let error = []
  
  if(contacts){
    if(contacts.length>50){
      return res.status(400).json({
        status: false,
        error: 'You can send max 50 contacts at a time'
      })
    }
    
    sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
    
    for(let i=0; i<contacts.length; i++){
      const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
        console.log('err', err)
      }) 
      let video_titles = ''
      let video_descriptions = ''
      let video_objects = ''
      let video_subject = subject
      let video_content = content
      let activity
      for(let j=0; j<videos.length; j++){
          const video = videos[j]         
          let preview
          if(video['preview']){
            preview = video['preview']
          } else {
            preview = video['thumbnail'] + '?resize=true'
          }
      
          
          if(typeof video_content == 'undefined'){
            video_content = ''
          }
          
          video_subject = video_subject.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
          video_content = video_content.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
          const _activity = new Activity({
            content: 'sent video using email',
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content
          })
          
          activity = await _activity.save().then().catch(err=>{
            console.log('err', err)
          })
          
          if(videos.length>=2){
            video_titles = mail_contents.VIDEO_TITLE
          }else{
            video_titles = `${video.title}`
          }
          
          if(j < videos.length-1){  
            video_descriptions = video_descriptions + `${video.description}, ` 
          } else{
            video_descriptions = video_descriptions + video.description
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id
          //const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          video_objects = video_objects + video_object                      
      }
      
      if(subject == '' ){
        video_subject = 'VIDEO: ' + video_titles
      } else {
        video_subject = video_subject.replace(/{video_title}/ig, video_titles)
        video_subject = video_subject.replace(/{material_title}/ig, video_titles)
      }
    
        if(video_content.search(/{video_object}/ig) != -1){
          video_content = video_content.replace(/{video_object}/ig, video_objects)
        }else{
          video_content = video_content+'<br/>'+video_objects
        }
        
        if(content.search(/{video_title}/ig) != -1){
          video_content = video_content.replace(/{video_title}/ig, video_titles)
        }
        
        if(content.search(/{video_description}/ig) != -1){
          video_content = video_content.replace(/{video_description}/ig, video_descriptions)
        }
        
        const msg = {
          to: _contact.email,
          from: `${currentUser.user_name} <${mail_contents.MAIL_SEND}>`,
          replyTo: currentUser.email,
          subject: video_subject,
          html: '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">'
                +video_content+'<br/>Thank you,<br/><br/>'+ currentUser.email_signature + '</body></html>',
          text: video_content
        }
        
        let promise = new Promise((resolve, reject)=>{
          sgMail.send(msg).then(async(_res) => {
          console.log('mailres.errorcode', _res[0].statusCode);
          if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
            console.log('status', _res[0].statusCode)
            Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
              console.log('err', err)
            })
            resolve()
          }else {  
            Activity.deleteOne({_id: activity.id}).catch(err=>{
              console.log('err', err)
            })
            console.log('email sending err', msg.to+res[0].statusCode)
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email
              },
              err: _res[0].statusCode
            })
          }
        }).catch(err => {
          Activity.deleteOne({_id: activity.id}).catch(err=>{
            console.log('err', err)
          })
          console.log('email sending err', msg.to)
          console.error(err)
          error.push({
            contact: {
              first_name: _contact.first_name,
              email: _contact.email
            },
            err: err
          })
          resolve()
        })
      })
      promise_array.push(promise)
    }
      
    Promise.all(promise_array).then(()=>{
      if(error.length>0){
        return res.status(200).json({
          status: false,
          error: error
        })
      }
      return res.send({
        status: true
      })
    }).catch(err=>{
      console.log('err', err)
      if(err){
        return res.status(400).json({
          status: false,
          error: err
        })
      }
    });
  }else {
      return res.status(400).json({
        status: false,
        error: 'Contacts not found'
      })
  }  
}

const bulkGmail = async(req, res) => {
  const { currentUser } = req
  let {content, subject, videos, contacts} = req.body 
  let promise_array = []
  let error = []

  const oauth2Client = new google.auth.OAuth2(
    config.GMAIL_CLIENT.GMAIL_CLIENT_ID,
    config.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
    urls.GMAIL_AUTHORIZE_URL
  )
  const token = JSON.parse(currentUser.google_refresh_token)
  oauth2Client.setCredentials({refresh_token: token.refresh_token}) 
  await oauth2Client.getAccessToken();
  let gmail = google.gmail({ auth: oauth2Client, version: 'v1' });

  if(contacts){
    if(contacts.length>50){
      return res.status(400).json({
        status: false,
        error: 'You can send max 50 contacts at a time'
      })
    }
    
    for(let i=0; i<contacts.length; i++){
      const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
        console.log('err', err)
      }) 
      let video_titles = ''
      let video_descriptions = ''
      let video_objects = ''
      let video_subject = subject
      let video_content = content
      let activity
      for(let j=0; j<videos.length; j++){
          const video = videos[j]         
          let preview
          if(video['preview']){
            preview = video['preview']
          } else {
            preview = video['thumbnail'] + '?resize=true'
          }
               
          if(typeof video_content == 'undefined'){
            video_content = ''
          }
          
          video_subject = video_subject.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
          video_content = video_content.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
          const _activity = new Activity({
            content: 'sent video using email',
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content
          })
          
          activity = await _activity.save().then().catch(err=>{
            console.log('err', err)
          })
          
          if(videos.length>=2){
            video_titles = mail_contents.VIDEO_TITLE
          }else{
            video_titles = video.title
          }
          
          if(j < videos.length-1){
            video_descriptions = video_descriptions + `${video.description}, ` 
          } else{
            video_descriptions = video_descriptions + video.description
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id
          //const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          video_objects = video_objects + video_object                      
      }
      
      if(video_subject == '' ){
        video_subject = 'VIDEO: ' + video_titles
      } else {
        video_subject = video_subject.replace(/{video_title}/ig, video_titles)
        video_subject = video_subject.replace(/{material_title}/ig, video_titles)
      }
    
        if(video_content.search(/{video_object}/ig) != -1){
          video_content = video_content.replace(/{video_object}/ig, video_objects)
        }else{
          video_content = video_content+'<br/>'+video_objects
        }
        
        if(content.search(/{video_title}/ig) != -1){
          video_content = video_content.replace(/{video_title}/ig, video_titles)
        }
        
        if(content.search(/{video_description}/ig) != -1){
          video_content = video_content.replace(/{video_description}/ig, video_descriptions)
        }

        const email_content = '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">'
          +video_content+'<br/>Thank you,<br/><br/>'+ currentUser.email_signature + '</body></html>';
        
        // const rawContent = makeBody(_contact.email, `${currentUser.user_name} <${currentUser.email}>`, video_subject, email_content );
        
        let promise = new Promise((resolve, reject)=>{
          // gmail.users.messages.send({
          //   'auth': oauth2Client,
          //   'userId': 'me',
          //   'resource': {
          //     raw: rawContent
          //   }
          // }, (err, response) => {
          //   if(err) {
          //     Activity.deleteOne({_id: activity.id}).catch(err=>{
          //       console.log('err', err)
          //     })
          //     console.log('err', err.response['statusText'])
          //     error.push({
          //       contact: {
          //         id: contacts[i],
          //         first_name: _contact.first_name,
          //         email: _contact.email,
          //       },
          //       err: err.response['statusText'] 
          //     })
          //     resolve();
          //   } else {
          //     Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
          //       console.log('err', err)
          //     })
          //     resolve()
          //   }
          // }); 
          try{
            let body = createBody({
              headers: {
                To: _contact.email,
                From: `${currentUser.user_name} <${currentUser.email}>`,
                Subject: video_subject,
              },
              textHtml:  email_content,
              textPlain: email_content,
            });
            request({
              method: 'POST',
              uri: 'https://www.googleapis.com/upload/gmail/v1/users/me/messages/send',
              headers: {
                Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
                'Content-Type': 'multipart/related; boundary="foo_bar_baz"'
              },
              body: body
            }).then(()=>{
              Contact.update({_id: contacts[i]},{ $set: {last_activity: activity.id} }).catch(err=>{
                console.log('err', err)
              })
              resolve();
            })
          }catch(err){
            console.log('err', err)
            Activity.deleteOne({_id: activity.id}).catch(err=>{
              console.log('err', err)
            })
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email,
              },
              err: err
            })
          }
        })
      promise_array.push(promise)
    }
      
    Promise.all(promise_array).then(()=>{
      if(error.length>0){
        return res.send({
          status: false,
          error
        })
      }
      return res.send({
        status: true
      })
    }).catch(err=>{
      console.log('err', err)
      if(err){
        return res.status(400).json({
          status: false,
          error: err
        })
      }
    });
  }else {
      return res.status(400).json({
        status: false,
        error: 'Contacts not found'
      })
  }  
}

const bulkText = async(req, res) => {
  const { currentUser } = req
  let {content, videos, contacts} = req.body 
  let promise_array = []
  let error = []
  if(contacts){
    if(contacts.length>50){
      return res.status(400).json({
        status: false,
        error: 'You can send max 50 contacts at a time'
      })
    }
    
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
          error.push({
            contact: {
              first_name: _contact.first_name,
              cell_phone: _contact.cell_phone,
            },
            err: 'Invalid phone number' 
          })
          resolve() // Invalid phone number
        }
        twilio.messages.create({from: fromNumber, body: video_content,  to: e164Phone}).then(()=>{
          console.info(`Send SMS: ${fromNumber} -> ${_contact.cell_phone} :`, video_content)
          Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
            console.log('err', err)
          })
          resolve()
        }).catch(err=>{
          console.log('err', err)
          Activity.deleteOne({_id: activity.id}).catch(err=>{
            console.log('err', err)
          })
          error.push({
            contact: {
              first_name: _contact.first_name,
              cell_phone: _contact.cell_phone,
            },
            err: err
          })
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
  }else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found'
    })
  }
}

const createSmsContent = async (req, res) => {
  const { currentUser } = req;
  let { content, subject, videos, contacts } = req.body

  const _contact = await Contact.findOne({_id: contacts[0]}).catch(err => {
    console.log('err', err)
  })

  let video_titles = ''
  let video_descriptions = ''
  let video_objects = ''
  let video_subject = ''
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
      contacts: contacts[0],
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
    const video_object = `\n${video.title}:\n${video_link}\n`
    video_objects = video_objects + video_object                      
  }

  if(video_content.search(/{video_object}/ig) != -1){
    video_content = video_content.replace(/{video_object}/ig, video_objects)
  }else{
    video_content = video_content+video_objects
  }
    
  if(video_content.search(/{video_title}/ig) != -1){
    video_content = video_content.replace(/{video_title}/ig, video_titles)
  }
    
  if(video_content.search(/{video_description}/ig) != -1){
    video_content = video_content.replace(/{video_description}/ig, video_descriptions)
  }

  return res.send({
    status: true,
    data: video_content
  })
}

const bulkOutlook = async(req, res) => {
  const { currentUser } = req
  let {content, subject, videos, contacts} = req.body 
  let promise_array = []
  let error = []

  if(contacts){
    if(contacts.length>50){
      return res.status(400).json({
        status: false,
        error: 'You can send max 50 contacts at a time'
      })
    }
    let token = oauth2.accessToken.create({ refresh_token: currentUser.outlook_refresh_token, expires_in: 0})
    
    for(let i=0; i<contacts.length; i++){
      
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
      const _contact = await Contact.findOne({_id: contacts[i]}).catch(err=>{
        console.log('err', err)
      }) 
      let video_titles = ''
      let video_descriptions = ''
      let video_objects = ''
      let video_subject = subject
      let video_content = content
      let activity
      for(let j=0; j<videos.length; j++){
          const video = videos[j]         
          let preview
          if(video['preview']){
            preview = video['preview']
          } else {
            preview = video['thumbnail'] + '?resize=true'
          }
      
          
          if(typeof video_content == 'undefined'){
            video_content = ''
          }
          
          video_subject = video_subject.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
          video_content = video_content.replace(/{user_name}/ig, currentUser.user_name)
          .replace(/{user_email}/ig, currentUser.email).replace(/{user_phone}/ig, currentUser.cell_phone)
          .replace(/{contact_first_name}/ig, _contact.first_name).replace(/{contact_last_name}/ig, _contact.last_name)
          .replace(/{contact_email}/ig, _contact.email).replace(/{contact_phone}/ig, _contact.cell_phone)
          
          const _activity = new Activity({
            content: 'sent video using email',
            contacts: contacts[i],
            user: currentUser.id,
            type: 'videos',
            videos: video._id,
            created_at: new Date(),
            updated_at: new Date(),
            subject: video_subject,
            description: video_content
          })
          
          activity = await _activity.save().then().catch(err=>{
            console.log('err', err)
          })
          
          if(videos.length>=2){
            video_titles = mail_contents.VIDEO_TITLE
          }else{
            video_titles = `${video.title}`
          }
          
          if(j < videos.length-1){
            video_descriptions = video_descriptions + `${video.description}, ` 
          } else{
            video_descriptions = video_descriptions + video.description
          }
          const video_link = urls.MATERIAL_VIEW_VIDEO_URL + activity.id
          //const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/>${video.description}<br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          const video_object = `<p style="margin-top:0px;max-width: 800px;"><b>${video.title}:</b><br/><br/><a href="${video_link}"><img src="${preview}"/></a><br/></p>`
          video_objects = video_objects + video_object                      
      }
      
      if(video_subject == '' ){
        video_subject = 'VIDEO: ' + video_titles
      } else {
        video_subject = video_subject.replace(/{video_title}/ig, video_titles)
        video_subject = video_subject.replace(/{material_title}/ig, video_titles)
      }
    
        if(video_content.search(/{video_object}/ig) != -1){
          video_content = video_content.replace(/{video_object}/ig, video_objects)
        }else{
          video_content = video_content+'<br/>'+video_objects
        }
        
        if(content.search(/{video_title}/ig) != -1){
          video_content = video_content.replace(/{video_title}/ig, video_titles)
        }
        
        if(content.search(/{video_description}/ig) != -1){
          video_content = video_content.replace(/{video_description}/ig, video_descriptions)
        }
        
        const sendMail = {
          message: {
            subject: video_subject,
            body: {
              contentType: "HTML",
              content: '<html><head><title>Video Invitation</title></head><body><p style="white-space:pre-wrap;max-width: 800px;margin-top:0px;">'
              +video_content+'<br/>Thank you,<br/><br/>'+ currentUser.email_signature + '</body></html>'
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
      
        let promise = new Promise((resolve, reject)=>{
          client.api('/me/sendMail')
          .post(sendMail).then(()=>{
            Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
              console.log('err', err)
            })
            resolve()
          }).catch(err=>{
            Activity.deleteOne({_id: activity.id}).catch(err=>{
              console.log('err', err)
            })
            console.log('err', err)
            error.push({
              contact: {
                first_name: _contact.first_name,
                email: _contact.email
              },
              err: err
            })
            resolve()
          });    
        })
      promise_array.push(promise)
    }
      
    Promise.all(promise_array).then(()=>{
      if(error.length>0){
        return res.status(200).json({
          status: false,
          error: error
        })
      }
      return res.send({
        status: true
      })
    }).catch(err=>{
      console.log('err', err)
      if(err){
        return res.status(400).json({
          status: false,
          error: err
        })
      }
    });
  }else {
      return res.status(400).json({
        status: false,
        error: 'Contacts not found'
      })
  }  
}

const makeBody = (to, from, subject, message) => {
  var str = ["Content-Type: text/html; charset=\"UTF-8\"\n", "MIME-Version:1.0\n", "Content-Transfer-Encoding: 7bit\n",
    "to: ", to, "\n", "from: ", from, "\n", "subject: ", subject, "\n\n", message].join('');
  var encodedMail = Base64.encodeURI(str);
  return encodedMail;
}

module.exports = {
  play,
  play1,
  embedPlay,
  pipe,
  create,
  updateDetail,
  updateDefault,
  get,
  getThumbnail,
  getAll,
  bulkEmail,
  bulkText,
  remove,
  getHistory,
  createVideo,
  createSmsContent,
  bulkGmail,
  bulkOutlook
}


