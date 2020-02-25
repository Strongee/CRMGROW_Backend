const express = require('express')
const fs = require('fs')
const AWS = require('aws-sdk')
const multer = require('multer');
const multerS3 = require('multer-s3')
const mime = require('mime-types')
const uuidv1 = require('uuid/v1')

const PDFCtrl = require('../../controllers/admin/pdf')
const UserCtrl = require('../../controllers/admin/user')
const { catchError } = require('../../controllers/error')
const config  = require('../../config/config')

const s3 = new AWS.S3({
  accessKeyId: config.AWS.AWS_ACCESS_KEY,
  secretAccessKey: config.AWS.AWS_SECRET_ACCESS_KEY,
  region: config.AWS.AWS_S3_REGION
})

const router = express.Router()

const storage = multerS3({
  s3: s3,
  bucket: config.AWS.AWS_S3_BUCKET_NAME,
  acl: 'public-read',
  metadata: function (req, file, cb) {
    cb(null, {fieldName: file.fieldname});
  },
  key: function (req, file, cb) {
    const today = new Date()
    const year = today.getYear()
    const month = today.getMonth()
    cb(null, 'pdf ' + year + '/' + month + '/' + file.originalname)
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

router.get('/list/:page', catchError(PDFCtrl.getPdfs))

// Get all pdfs by user
router.post('/user/:id', catchError(PDFCtrl.getPdfsByUser))

module.exports = router