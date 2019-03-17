const path = require('path')
const mime = require('mime-types')
const fs = require('fs')

const Video = require('../models/video')
const { FILES_PATH } = require('../config/path')

const create = async (req, res) => {
  console.log('req.files',req.files)
  // if (req.file) {
  //     if (req.currentUser) {
  //         const Video = new Video({
  //             user: req.currentUser.id,
  //             name: req.files[0].filename,
  //             type: req.files[0].mimetype
  //         })
  //         await file.save()
  //     }
  //     res.send({
  //       status: true,
  //       data: {
  //         file_name: req.file.filename,
  //         url: process.env.TEAMGROW_DOMAIN + '/api/file/' + req.file.filename
  //       }
  //     })
  // }
    res.json({'video': req.file.location})
}

const get = (req, res) => {
    const filePath = FILES_PATH + req.params.id
    console.info('File Path:', filePath)
    if (fs.existsSync(filePath)) {
      const contentType = mime.contentType(path.extname(req.params.id))
      res.set('Content-Type', contentType)
      res.sendFile(filePath)
    } else {
      res.status(404).send({
        status: false,
        error: 'File does not exist'
      })
    }
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
    remove
}