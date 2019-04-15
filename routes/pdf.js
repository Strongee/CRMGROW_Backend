const express = require('express')
const fs = require('fs')
const AWS = require('aws-sdk')
const multer = require('multer');
const multerS3 = require('multer-s3')
const mime = require('mime-types')
const uuidv1 = require('uuid/v1')

const PDFCtrl = require('../controllers/pdf')
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


// Upload a pdf
router.post('/', UserCtrl.checkAuth, upload.single('pdf'), catchError(PDFCtrl.create))

// Upload a preview and detail info
router.put('/:id', UserCtrl.checkAuth, catchError(PDFCtrl.updateDetail))

// Upload a preview and detail info
router.get('/preview/:name', catchError(PDFCtrl.getPreview))

// Get a pdf
router.get('/:id', catchError(PDFCtrl.get))

// Get all pdf
router.get('/', UserCtrl.checkAuth, catchError(PDFCtrl.getAll))

// Send PDF
router.post('/send', UserCtrl.checkAuth, catchError(PDFCtrl.sendPDF))

// Delete a pdf
router.delete('/:id', UserCtrl.checkAuth, catchError(PDFCtrl.remove))


module.exports = router