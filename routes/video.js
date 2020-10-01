const express = require('express');
const fs = require('fs');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mime = require('mime-types');
const uuidv1 = require('uuid/v1');

const VideoCtrl = require('../controllers/video');
const UserCtrl = require('../controllers/user');
const { catchError } = require('../controllers/error');
const api = require('../config/api');
const { TEMP_PATH } = require('../config/path');

const s3 = new AWS.S3({
  accessKeyId: api.AWS.AWS_ACCESS_KEY,
  secretAccessKey: api.AWS.AWS_SECRET_ACCESS_KEY,
  region: api.AWS.AWS_S3_REGION,
});

const router = express.Router();

const fileStorage = multer.diskStorage({
  destination: function fn(req, file, cb) {
    if (!fs.existsSync(TEMP_PATH)) {
      fs.mkdirSync(TEMP_PATH);
    }
    cb(null, TEMP_PATH);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv1() + '.' + mime.extension(file.mimetype));
  },
});

const upload = multer({ storage: fileStorage });

router.post('/create', UserCtrl.checkAuth, catchError(VideoCtrl.createVideo));

// Upload a video
router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  upload.single('video'),
  catchError(VideoCtrl.create)
);

// Upload a thumbnail and detail info when upload a video at first
router.put(
  '/detail/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.updateDetail)
);

// Upload a thumbnail and detail info
router.put('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.update));

// Upload a thumbnail and detail info
router.get('/thumbnail/:name', catchError(VideoCtrl.getThumbnail));

// Bulk videos
router.post(
  '/bulk-email',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.bulkEmail)
);

// Bulk videos
router.post(
  '/bulk-outlook',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.bulkOutlook)
);

// Bulk videos
router.post(
  '/bulk-gmail',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.bulkGmail)
);

// Bulk texts
router.post(
  '/bulk-text',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.bulkText)
);

// Sms Content
router.post(
  '/sms-content',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.createSmsContent)
);

// Default Video Edit
router.post(
  '/update-admin',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(VideoCtrl.updateDefault)
);

// Streaming video
router.get('/pipe/:name', catchError(VideoCtrl.pipe));

// Get Conver progress of a video
router.post(
  '/convert-status',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getConvertStatus)
);

router.get(
  '/latest-sent/:id',
  UserCtrl.checkAuth,
  catchError(VideoCtrl.getContactsByLatestSent)
);

// Get all video
router.get('/', UserCtrl.checkAuth, catchError(VideoCtrl.getAll));

router.get('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.get));

// Delete a video
router.delete('/:id', UserCtrl.checkAuth, catchError(VideoCtrl.remove));

module.exports = router;
