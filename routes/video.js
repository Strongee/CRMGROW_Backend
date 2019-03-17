const express = require('express')
const fs = require('fs')
const AWS = require('aws-sdk')
const multer = require('multer');
const multerS3 = require('multer-s3')

const VideoCtrl = require('../controllers/video')
const UserCtrl = require('../controllers/user')
const { catchError } = require('../controllers/error')

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
})

const router = express.Router()

const fileStorage = multerS3({
    s3: s3,
    bucket: process.env.BUCKET_NAME,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString())
    }
  })

const upload = multer({
    storage: fileStorage
  })


// Upload a file
router.post('/', UserCtrl.checkAuth, upload.array('upl',1), catchError(VideoCtrl.create))

// Get a file
router.get('/:id', catchError(VideoCtrl.get))

// Delete a file
router.delete('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.remove))


module.exports = router
