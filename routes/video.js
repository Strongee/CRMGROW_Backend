const express = require('express')
const fs = require('fs')
const AWS = require('aws-sdk')
const multer = require('multer');
const multerS3 = require('multer-s3')
const mime = require('mime-types')
const uuidv1 = require('uuid/v1')

const VideoCtrl = require('../controllers/video')
const UserCtrl = require('../controllers/user')
const { catchError } = require('../controllers/error')
const config  = require('../config/config')
const { TEMP_PATH } = require('../config/path')

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const router = express.Router()

// const storage = multerS3({
//     s3: s3,
//     bucket: config.AWS.AWS_S3_BUCKET_NAME,
//     acl: 'public-read',
//     metadata: function (req, file, cb) {
//       cb(null, {fieldName: file.fieldname});
//     },
//     key: function (req, file, cb) {
//       const today = new Date()
//       const year = today.getYear()
//       const month = today.getMonth()
//       cb(null, 'video' +  year + '/' + month + '/' + file.originalname)
//     },
//   })


// const upload = multer({
//     storage: storage
//   })

  const fileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, TEMP_PATH)
    },
    filename: (req, file, cb) => {
      cb(null, uuidv1() + '.' + mime.extension(file.mimetype))
    }
  })
  
  
const upload = multer({ storage: fileStorage })

// Upload a video
router.post('/', UserCtrl.checkAuth, UserCtrl.checkSuspended, upload.single('video'), catchError(VideoCtrl.create))

// Upload a thumbnail and detail info
router.put('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.updateDetail))

// Upload a thumbnail and detail info
router.get('/thumbnail/:name', catchError(VideoCtrl.getThumbnail))

// Get a video
router.get('/:id', catchError(VideoCtrl.get))

// Get all video
router.get('/', UserCtrl.checkAuth, catchError(VideoCtrl.getAll))

// Send Video
router.post('/send', UserCtrl.checkAuth, UserCtrl.checkSuspended, catchError(VideoCtrl.sendVideo))

// Send Video on text
router.post('/send-text', UserCtrl.checkAuth, UserCtrl.checkSuspended, catchError(VideoCtrl.sendText))

// Bulk videos
router.post('/bulk-email', UserCtrl.checkAuth, UserCtrl.checkSuspended, catchError(VideoCtrl.bulkEmail))

// Streaming video
router.get('/pipe/:name', catchError(VideoCtrl.pipe))

// Delete a video
router.delete('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.remove))

module.exports = router
