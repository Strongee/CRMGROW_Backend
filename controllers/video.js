const path = require('path')
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
const base64Img = require('base64-img');
 
const Video = require('../models/video')
const VideoTracker = require('../models/video_tracker')
const { FILES_PATH } = require('../config/path')
const { THUMBNAILS_PATH } = require('../config/path')

const create = async (req, res) => {
  if (req.file) {
      if(req.currentUser){
        const video = new Video({
          user: req.currentUser.id,
          type: req.file.mimetype,
          url: req.file.location,
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
  if (req.body.thumbnail) { // base 64 image
    const editData = req.body
    const file_name = uuidv1()
    const file_path = base64Img.imgSync(req.body.thumbnail, THUMBNAILS_PATH, file_name)
    if (req.currentUser) {
      const video = await Video.findOne({user: currentUser.id, _id: req.params.id})

      if (!video) {
        return res.status(401).json({
          status: false,
          error: 'Invalid_permission'
        })
      }

      for (let key in editData) {
        video[key] = editData[key]
      }

      video['thumbnail'] = process.env.TEAMGROW_DOMAIN + '/api/file/' + path.basename(file_path)

      video["updated_at"] = new Date()

      video.save().then((_video)=>{
        res.send({
          status: true,
          data: _video
        })
      })
    }
  }

  res.status(401).json({
    status: false,
    error: 'Not found thumbnail'
  })
}


const get = async (req, res) => {
  const data = Video.findOne({ _id: req.params.id})

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Video doesn`t exist'
    })
  }

  res.send({
    status: true,
    data
  })

}

const getAll = async (req, res) => {
  const {currentUser} = req
  const _video = VideoTracker.find({ user: currentUser.id})

  if (!_video) {
    return res.status(401).json({
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
  const {email, content, video_id, contact_id} = req.body
  sgMail.setApiKey(process.env.SENDGRID_KEY);

  const text = content + '/material/view/video/?video=' + video_id + '&contact=' + contact_id
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

const remove = async (req, res) => {
    const { currentUser } = req
    try {
      const file = File.findOne({ user: currentUser.id, name: req.params.id})
  
      if (file) {
        fs.unlinkSync(FILES_PATH + req.params.id)
        res.send({
          status: true,
          data: {
            file_name: req.params.id
          }
        })
      } else {
        res.status(404).send({
          status: false,
          error: 'file_not_found'
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
    getAll,
    sendVideo,
    remove
}