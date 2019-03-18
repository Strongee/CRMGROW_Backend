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

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
})

const router = express.Router()

const storage = multerS3({
    s3: s3,
    bucket: process.env.BUCKET_NAME,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      cb(null, uuidv1() + '.' + mime.extension(file.mimetype))
    },
  })


const upload = multer({
    storage: storage
  })


// Upload a video
router.post('/', UserCtrl.checkAuth, upload.single('video'), catchError(VideoCtrl.create))

// Upload a thumbnail

router.put('/', UserCtrl.checkAuth, catchError(VideoCtrl.updateDetail))

// Get a video
router.get('/:id', catchError(VideoCtrl.get))

// Get all video
router.get('/', UserCtrl.checkAuth, catchError(VideoCtrl.getAll))

// Delete a video
router.delete('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.remove))


module.exports = router
