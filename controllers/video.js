const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
const mime = require('mime-types')

const User = require('../models/user')
const Activity = require('../models/activity')
const Video = require('../models/video')
const VideoTracker = require('../models/video_tracker')
const Contact = require('../models/contact')
const { THUMBNAILS_PATH } = require('../config/path')
const urls = require('../constants/urls')
const config = require('../config/config')
const {TEMP_PATH, GIF_PATH } = require('../config/path')
const uuidv1 = require('uuid/v1')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const AWS = require('aws-sdk')
const GIFEncoder = require('gifencoder');

const extractFrames = require('ffmpeg-extract-frames')
const { createCanvas, loadImage } = require('canvas')
const pngFileStream = require('png-file-stream');
const sharp = require('sharp');

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const play = async(req, res) => {  
  const video_id = req.query.video
  const sender_id = req.query.user
  const video = await Video.findOne({_id: video_id})
  const sender = await User.findOne({_id: sender_id})
 
  res.render('video', {
      video: video,
      sender: sender
  })
}

const play1 = async(req, res) => {  
  const activity = await Activity.findOne({_id: req.params.id}).populate([{path:'user'}, {path:'videos'}]).catch(err =>{
    console.log('err', err)
  })
  
  const data = activity['user']
  myJSON = JSON.stringify(data)
  const user = JSON.parse(myJSON);
  delete user.hash
  delete user.salt
  delete user.payment
  
  const video = activity['videos']
  
  res.render('video1', {
      video: video,
      user: user,
      contact: activity['contacts'],
      activity: activity.id
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

const updateDetail = async (req, res) => {
  const editData = req.body
  let thumbnail;
  
  if (req.body.thumbnail) { // base 64 image    
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
    thumbnail = urls.VIDEO_THUMBNAIL_URL + path.basename(file_path)
  }
  
  const video = await Video.findOne({_id: req.params.id}).catch(err=>{
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
  
  if(!video['preview']){
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

  let _video_list = await Video.find({user: currentUser.id, del: false}).sort({created_at : 1 })
  let _video_admin = await Video.find({role: "admin", del: false}).sort({created_at : 1 })
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

const sendVideo = async (req, res) => {
  const { currentUser } = req
  let {content, subject, video, video_title, contacts} = req.body 
    if(contacts){
      if(contacts.length>15){
        return res.status(400).json({
          status: false,
          error: 'You can sent max 15 contacts'
        })
      }
      for(let i=0; i<contacts.length; i++){
        const _contact = await Contact.findOne({_id: contacts[i]})
        const _activity = new Activity({
          content: currentUser.user_name + ' sent video using email',
          contacts: contacts[i],
          user: currentUser.id,
          type: 'videos',
          videos: video,
          created_at: new Date(),
          updated_at: new Date(),
          subject: subject,
          description: content
        })
       
        const _video = await Video.findOne({_id: video})
        let preview
        if(_video['preview']){
          preview = _video['preview']
        } else {
          preview = _video['thumbnail'] + '?resize=true'
        }
        const activity = await _activity.save().then().catch(err=>{
          console.log('err', err)
        })
        Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
          console.log('err', err)
        })
        sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);
      
        if(subject == '' ){
          subject = video_title
        }
        
        if(typeof content == 'undefined'){
          content = ''
        }
      
        const video_link =urls.MATERIAL_VIEW_VIDEO_URL + activity.id
        
        const msg = {
          to: _contact.email,
          from: currentUser.email,
          subject: subject,
          html: '<html><head><title>Video Invitation</title></head><body><p style="white-space: pre-wrap;">'
                +content+'</p><a href="' + video_link + '"><img src="'
                +preview+'"/></a><br/><br/>Thank you<br/><br/>'+ currentUser.email_signature + '</body></html>'
          
        }
      
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

const sendText = async (req, res) => {
  const { currentUser } = req
  const { content, video, video_title, contacts} = req.body
  
  if(contacts){
    if(contacts.length>15){
      return res.status(400).json({
        status: false,
        error: 'You can sent max 15 contacts'
      })
    }
    for(let i=0; i<contacts.length; i++){
      const _contact = await Contact.findOne({_id: contacts[i]})
      const cell_phone = _contact.cell_phone
      const _activity = new Activity({
        content: currentUser.user_name + ' sent video using sms',
        contacts: contacts[i],
        user: currentUser.id,
        type: 'videos',
        videos: video,
        created_at: new Date(),
        updated_at: new Date(),
        description: content
      })
      const activity = await _activity.save().then().catch(err=>{
        console.log('err', err);
      })
      Contact.findByIdAndUpdate(contacts[i],{ $set: {last_activity: activity.id} }).catch(err=>{
        console.log('err', err)
      })
      const video_link =urls.MATERIAL_VIEW_VIDEO_URL + activity.id
      const e164Phone = phone(cell_phone)[0];
      
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
  
        let body
        if(typeof content == 'undefined'){
          body = video_link
        }else{
          body = content + '\n' + '\n' + video_link
        }
      
        twilio.messages.create({from: fromNumber, body: body,  to: e164Phone}).then(()=>{
          console.info(`Send SMS: ${fromNumber} -> ${cell_phone} :`, content)
        }).catch(err=>{
          console.log('err', err)
        })  
    }
    return res.send({
      status: true
    })
  }else {
    return res.status(400).json({
      status: false,
      error: 'Contacts not found'
    })
  }     
}

const remove = async (req, res) => {
  const { currentUser } = req
    try {
      const video = await Video.findOne({ _id: req.params.id, user: currentUser.id})
      let url =  video.url
  
      if (video) {
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

module.exports = {
    play,
    play1,
    pipe,
    create,
    updateDetail,
    get,
    getThumbnail,
    getAll,
    sendVideo,
    sendText,
    remove,
    getHistory
}


