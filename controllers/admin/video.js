const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
const mime = require('mime-types')

const Video = require('../../models/video')
const User = require('../../models/user')
const VideoTracker = require('../../models/video_tracker')
const { FILES_PATH } = require('../../config/path')
const { THUMBNAILS_PATH } = require('../../config/path')
const uuidv1 = require('uuid/v1')

const create = async (req, res) => {
  if (req.file) {
      if(req.currentUser){
        const video = new Video({
          user: req.currentUser.id,
          type: req.file.mimetype,
          url: req.file.location,
          role: 'admin',
          created_at: new Date()
        })

        video.save().then((_video)=>{
          res.send({
            status: true,
            data: _video
          })
        })
    }
  }
}

const updateDetail = async (req, res) => {
  const {currentUser} = req
  if (req.body.thumbnail) { // base 64 image
    const editData = req.body
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
      const video = await Video.findOne({user: currentUser.id, _id: req.params.id})

      console.log('video', video)
      if (!video) {
        return res.status(400).json({
          status: false,
          error: 'Invalid_permission'
        })
      }

      for (let key in editData) {
        video[key] = editData[key]
      }

      video['thumbnail'] = process.env.TEAMGROW_DOMAIN + '/api/video/thumbnail/' + path.basename(file_path)

      video["updated_at"] = new Date()

      video.save().then((_video)=>{
        console.log('video', video)
        res.send({
          status: true,
          data: _video
        })
      })

  }else{
    res.status(400).json({
      status: false,
      error: 'Not_found_thumbnail'
    })
  }
}


const get = async (req, res) => {
  const video = await Video.findOne({_id: req.params.id})
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
  const _video = VideoTracker.find({ user: currentUser.id})

  if (!_video) {
    return res.status(400).json({
      status: false,
      error: 'Video doesn`t exist'
    })
  }

  const _video_list = await Video.find({user: currentUser.id})
  console.log('_video_list',_video_list)
  let _video_detail_list = [];

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
          $match: { "video": _video_list[i].id }
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
  const {email, content, video, contact} = req.body
  sgMail.setApiKey(process.env.SENDGRID_KEY);

  const text = content + '\n' + process.env.TEAMGROW_DOMAIN +'/material/view/video/?video=' + video + '&contact=' + contact + '&user=' + currentUser.id
  const msg = {
    to: email,
    from: currentUser.email,
    subject: process.env.WELCOME_SEND_VIDEO_MESSAGE,
    text: text,
    html: text
  }

  sgMail.send(msg).then((_res) => {
    console.log('mailres.errorcode', _res[0].statusCode);
    if(_res[0].statusCode >= 200 && _res[0].statusCode < 400){        
      console.log('status', _res[0].statusCode)
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
  res.send({
    status: true,
  })
}

const remove = async (req, res) => {
    const { currentUser } = req
    try {
      const video = Video.findOne({ user: currentUser.id, _id: req.params.id})
  
      if (video) {
        fs.unlinkSync(THUMBNAILS_PATH + req.params.id)
        res.send({
          status: true,
          data: {
            file_name: req.params.id
          }
        })
      } else {
        res.status(404).send({
          status: false,
          error: 'thumbnail_not_found'
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

module.exports = {
    create,
    updateDetail,
    get,
    getThumbnail,
    getAll,
    sendVideo,
    remove
}