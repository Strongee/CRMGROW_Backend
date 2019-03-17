const path = require('path')
const mime = require('mime-types')
const fs = require('fs')

const Video = require('../models/video')
const VideoTracker = require('../models/video_tracker')
const { FILES_PATH } = require('../config/path')

const create = async (req, res) => {
  console.log('req.file', req.filename)
  const {title, description} = req.body
  if (req.file) {
      if(req.currentUser){
        const video = new Video({
          user: req.currentUser.id,
          type: req.file.mimetype,
          url: req.file.location,
          title: title,
          description: description,
          created_at: new Date(),
          updated_at: new Date()
        })

        await video.save().then((_video)=>{
          res.send({
            status: true,
            data: _video
          })
        })
    }
  }
}

const get = async (req, res) => {
  const {currentUser} = req
  const data = Video.findOne({ user: currentUser.id, _id: req.params.id})

  if (!data) {
    return res.status(401).json({
      status: false,
      error: 'Invalid_permission'
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
            localField: video,
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
    get,
    getAll,
    remove
}