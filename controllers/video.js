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
const uuidv1 = require('uuid/v1')
const accountSid = config.TWILIO.TWILIO_SID
const authToken = config.TWILIO.TWILIO_AUTH_TOKEN
const phone = require('phone')
const twilio = require('twilio')(accountSid, authToken)
const AWS = require('aws-sdk')
const ffmpeg = require('ffmpeg');
const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const create = async (req, res) => {
  if (req.file) {
    if (req.currentUser) {
      const file_name = req.file.filename
      const file_path = req.file.path
      console.log('file_name', req.file)
      const video = new Video({
        user: req.currentUser.id,
        url: config.FILE_URL+file_name,
        type: req.file.mimetype,
        created_at: new Date()
      })
      const _video = await video.save().then()
      console.log('_video',_video)
      res.send({
        status: true,
        data: _video
      })
      
      try { 
        let process = new ffmpeg(file_path);
        process.then(function (_video) {
          console.log('The video is ready to be processed')
          fs.readFile(file_path, (err, data) => {
            if (err) throw err;
            console.log('File read was successful', data)
            const params = {
                Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
                Key: file_name, // file will be saved as testBucket/contacts.csv
                Body: JSON.stringify(data, null, 2)
            };
    
            console.log('here', _video)
            s3.upload(params, async function(s3Err, upload) {
                if (s3Err) throw s3Err
                console.log(`File uploaded successfully at ${upload.Location}`)

                const __video = await Video.findOne({_id: _video.id})
                __video['url'] = upload.Location
                __video.save().then(___video=>{
                  console.log('___video', ___video)
                }).catch(err=>{
                  console.log('err', err)
                })
                
            })
         });
        }, function (err) {
          console.log('Error: ' + err);
        });
      } catch (e) {
        console.log(e.code);
        console.log(e.msg);
      }
    }
  }
}




const updateDetail = async (req, res) => {
  
  const {currentUser} = req
  if (req.body.thumbnail) { // base 64 image
    const editData = req.body
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
    console.log('_id: req.params.id', req.params.id)
    const video = await Video.findOne({_id: req.params.id})

      if (!video) {
        return res.status(401).json({
          status: false,
          error: 'Invalid_permission'
        })
      }

      for (let key in editData) {
        video[key] = editData[key]
      }

      video['thumbnail'] = urls.VIDEO_THUMBNAIL_URL + path.basename(file_path)

      video["updated_at"] = new Date()

      video.save().then((_video)=>{
        res.send({
          status: true,
          data: _video
        })
      })

  }else{
    res.status(401).json({
      status: false,
      error: 'Not_found_thumbnail'
    })
  }
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
          $match: { "video": _video_list[i]._id }
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
  const {email, content, video, video_title, contact, contact_name} = req.body

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

  const video_link =urls.MATERIAL_VIEW_VIDEO_URL + '?video=' + video + '&contact=' + contact + '&user=' + currentUser.id + '&activity=' + activity.id
  const msg = {
    to: email,
    from: currentUser.email,
    subject: video_title,
    html: '<html><head><title>Video Invitation</title></head><body>Hi '+ contact_name.charAt(0).toUpperCase() + contact_name.slice(1) + 
          ',<br/><p>' + content + '</p><p>Please click on the video link below to learn more!<p/><a href="' + video_link + '">'+ video_title + 
          '</a><br/><br/>Thank you<br/><br/>'+ currentUser.email_signature + '</body></html>'
  }

  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){ 
      res.send({
        status: true,
      })
    }else {
      res.status(404).send({
        status: false,
        error: _res[0].statusCode
      })
    }
  }).catch ((e) => {
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

    const body = content + '\n' + video_title + '\n' + video_link
  
    twilio.messages.create({from: fromNumber, body: body,  to: e164Phone})
    
    res.send({
      status: true,
    })
        
}

const remove = async (req, res) => {
  const { currentUser } = req
    try {
      const video = await Video.findOne({ _id: req.params.id, user: currentUser.id})
  
      if (video) {
        s3.deleteObject({
          Bucket: config.AWS.AWS_S3_BUCKET_NAME,
          Key: video.url
        }, function (err,data){})

        video['del'] = true
        video.save()

        res.send({
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