const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
const mime = require('mime-types')

const User = require('../models/user')
const Activity = require('../models/activity')
const Video = require('../models/video')
const File = require('../models/file')
const VideoTracker = require('../models/video_tracker')
const { THUMBNAILS_PATH } = require('../config/path')
const urls = require('../constants/urls')
const config = require('../config/config')
const mail_contents = require('../constants/mail_contents')
const {TEMP_PATH, VIDEO_PATH} = require('../config/path')
const uuidv1 = require('uuid/v1')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const AWS = require('aws-sdk')

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const spawn = require('child-process-promise').spawn;

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

const vplay = async(req, res) => {  
  const video_id = req.query.video
  const sender_id = req.query.user
  const video = await Video.findOne({_id: video_id})
  const sender = await User.findOne({_id: sender_id})
 
  res.render('video1', {
      video: video,
      sender: sender
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
    if (req.currentUser) {
      const file_name = req.file.filename
      const file_path = req.file.path
 
      const video = new Video({
        user: req.currentUser.id,
        url: urls.VIDEO_URL+file_name,
        type: req.file.mimetype,
        created_at: new Date()
      })

      const _video = await video.save().then()
      res.send({
        status: true,
        data: _video
      })
      
    spawn(ffmpegPath, ['-i',file_path, '-s', 'hd720', '-c:v', 'libx264', '-crf', '23', '-c:a', 'aac', '-strict', `-2`, VIDEO_PATH+file_name]).then((_)=>{
        if (fs.existsSync(VIDEO_PATH+file_name)) {
        fs.readFile(VIDEO_PATH+file_name, (err, data) => {
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
              const __video = await Video.findOne({_id: _video.id})
              __video['url'] = upload.Location
              __video.save().catch(err=>{
                console.log('err', err)
              })

              fs.unlinkSync(VIDEO_PATH+file_name)

              setTimeout(function(){
                fs.unlinkSync(TEMP_PATH+file_name)
              }, 1000 * 60 * 60 * 2)     
          })
       });}
      }) 
    }
  }
}

const updateDetail = async (req, res) => {  
  const {currentUser} = req
  const editData = req.body
  let thumbnail;
  if (req.body.thumbnail) { // base 64 image    
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
    thumbnail = urls.VIDEO_THUMBNAIL_URL + path.basename(file_path)
  }

    const video = await Video.findOne({_id: req.params.id})

    if (!video) {
      return res.status(401).json({
        status: false,
        error: 'Invalid_permission'
      })
    }

    editData.url ? delete editData.url : '';
    editData.thumbnail ? delete editData.thumbnail : '';
    for (let key in editData) {
      video[key] = editData[key]
    }
    if( thumbnail ){
      video["thumbnail"] = thumbnail
    }
    video["updated_at"] = new Date()

    video.save().then((_video)=>{
      res.send({
        status: true,
        data: _video
      })
    })
}


const get = async (req, res) => {
  const video = await Video.findOne({_id: req.params.id, del: false})
  const user = await User.findOne({_id: video.user})
    if (!video) {
      return res.status(401).json({
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
    const contentType = mime.contentType(path.extname(req.params.name))
    res.set('Content-Type', contentType)
    res.sendFile(filePath)
  } else {
    res.status(404).send({
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
    return res.status(401).json({
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
  let {email, content, subject, video, video_title, video_preview, contact, contact_name} = req.body

  const _activity = new Activity({
    content: currentUser.user_name + ' sent video using email',
    contacts: contact,
    user: currentUser.id,
    type: 'videos',
    videos: video,
    created_at: new Date(),
    updated_at: new Date(),
  })
  activity = await _activity.save().then()

  sgMail.setApiKey(config.SENDGRID.SENDGRID_KEY);

  if(typeof subject == 'undefined'){
    subject = video_title
  }
  if(typeof content == 'undefined'){
    content = ''
  }

  const video_link =urls.MATERIAL_VIEW_VIDEO_URL + '?video=' + video + '&contact=' + contact + '&user=' + currentUser.id + '&activity=' + activity.id
  const msg = {
    to: email,
    from: currentUser.email,
    subject: subject,
    html: '<html><head><title>Video Invitation</title></head><body><p style="white-space: pre-wrap;">' + content + '</p>'+ 
    '<a href="' + video_link + '" style="background-image:url('+video_preview+');background-size:cover;background-repeat:no-repeat; width: 250px; height: 140px; display: block; position: relative;"><img src="'+urls.ASSETS_URL+'images/play_video.png" style="display:block; position:absolute; left:50%; top:50%;transform:translate(-50%,-50%);width:35px;height:25px;"/></img>' + 
     '</a><br/><br/>Thank you<br/><br/>'+ currentUser.email_signature + '</body></html>'
  }

  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
      res.send({
        status: true,
      })
    }else {
      console.log('email sending err', msg.to+res[0].statusCode)
      return res.status(404).send({
        status: false,
        error: _res[0].statusCode
      })
    }
  }).catch ((e) => {
    console.log('email sending err', msg.to)
    console.error(e)
    res.status(500).send({
      status: false,
      error: 'internal_server_error'
    })
  })
}

const sendText = async (req, res) => {
  const { currentUser } = req
  const { cell_phone, content, video, video_title, contact} = req.body

  const _activity = new Activity({
    content: currentUser.user_name + ' sent video using sms',
    contacts: contact,
    user: currentUser.id,
    type: 'videos',
    videos: video,
    created_at: new Date(),
    updated_at: new Date(),
  })
  activity = await _activity.save().then()
  
  const video_link =urls.MATERIAL_VIEW_VIDEO_URL + '?video=' + video + '&contact=' + contact + '&user=' + currentUser.id + '&activity=' + activity.id
  const e164Phone = phone(cell_phone)[0]
  const fromNumber = config.TWILIO.TWILIO_NUMBER
  console.info(`Send SMS: ${fromNumber} -> ${cell_phone} :`, content)

  if (!e164Phone) {
    const error = {
      error: 'Invalid Phone Number'
    }

    throw error // Invalid phone number
  }

    let body
    if(typeof content == 'undefined'){
      body = video_link
    }else{
      body = content + '\n' + video_link
    }
  
    twilio.messages.create({from: fromNumber, body: body,  to: e164Phone}).catch(err=>{
      console.log()
    })
    
    res.send({
      status: true,
    })
        
}

const remove = async (req, res) => {
  const { currentUser } = req
    try {
      const video = await Video.findOne({ _id: req.params.id, user: currentUser.id})
      let url =  video.url
  
      if (video) {
        s3.deleteObject({
          Bucket: config.AWS.AWS_S3_BUCKET_NAME,
          Key: video.url.slice(44)
        }, function (err,data){
          console.log('err', err)
          console.log('data', data)
        })

        video['del'] = true
        video.save()

        return res.send({
          status: true,
        })
      } else {
        res.status(200).send({
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
    vplay,
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


