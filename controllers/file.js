const path = require('path')
const mime = require('mime-types')
const fs = require('fs')
const sharp = require('sharp');
const AWS = require('aws-sdk')

const { FILES_PATH } = require('../config/path')
const config = require('../config/config')

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const File = require('../models/file')
const urls = require('../constants/urls')

const create = async (req, res) => {
  if (req.file) {
    const file_name = req.file.filename
    if (fs.existsSync(FILES_PATH+file_name)) { 
      sharp(FILES_PATH+file_name)
       .resize(100, 100)
       .toBuffer()
       .then(data => {
          console.log('data', data)
          const today = new Date()
          const year = today.getYear()
          const month = today.getMonth()
          const params = {
             Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
             Key: 'profile' +  year + '/' + month + '/' + file_name + '-resize', 
             Body: data,
             ACL: 'public-read'
           };
           
           s3.upload(params, async (s3Err, upload)=>{
            if (s3Err){
              console.log('upload s3 error', s3Err)
            } else {
              console.log(`File uploaded successfully at ${upload.Location}`)
            }
          })
       });
      
      fs.readFile(FILES_PATH+req.file.filename, (err, data) => {
        if (err){
          console.log('file read err', err)
          return res.status(400).send({
            status: false,
            error: 'file read error'
          })
        }else {
          console.log('File read was successful', data)
          const today = new Date()
          const year = today.getYear()
          const month = today.getMonth()
          const params = {
              Bucket: config.AWS.AWS_S3_BUCKET_NAME, // pass your bucket name
              Key: 'profile' +  year + '/' + month + '/' + file_name, 
              Body: data,
              ACL: 'public-read'
          };
          s3.upload(params, async (s3Err, upload)=>{
            if (s3Err){
              console.log('upload s3 error', s3Err)
              return res.status(400).send({
                status: false,
                error: 'file upload s3 error'
              })
            } else {
              
              return res.send({
                status: true,
                data: {
                  url: upload.Location
                }
              })
            }
          })
        }
     });
    }
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