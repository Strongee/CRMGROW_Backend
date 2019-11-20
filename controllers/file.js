const path = require('path')
const mime = require('mime-types')
const fs = require('fs')

const File = require('../models/file')
const { FILES_PATH } = require('../config/path')
const urls = require('../constants/urls')
const sharp = require('sharp');
const create = async (req, res) => {
    if (req.file) {
        if (req.currentUser) {
            const file = new File({
                user: req.currentUser.id,
                name: req.file.filename,
                type: 'image'
            })
            file.save()
        }
        return res.send({
          status: true,
          data: {
            file_name: req.file.filename,
            url:  urls.FILE_URL + req.file.filename
          }
        })
    }
}

const get = (req, res) => {
    const filePath = FILES_PATH + req.params.name
    console.info('File Path:', filePath)
    if (fs.existsSync(filePath)) {
      if(req.query.resize){
        const readStream = fs.createReadStream(filePath)
        let transform = sharp()
        transform = transform.resize(100, 100)
        return readStream.pipe(transform).pipe(res)
      }else{
        const contentType = mime.contentType(path.extname(req.params.name))
        res.set('Content-Type', contentType)
        return res.sendFile(filePath)
      }
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

const upload = async (req, res) => {
  if (req.file) {
      if(req.query.resize){
        const url = urls.FILE_URL + req.file.filename + '?resize=true'
        res.send({
          status: true,
          url: url
        })
      }else{
        const url = urls.FILE_URL + req.file.filename
        res.send({
          status: true,
          url: url
        })
      }  
  }
}


module.exports = {
    create,
    get,
    upload,
    remove
}