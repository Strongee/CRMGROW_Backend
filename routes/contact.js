const express = require('express')

const UserCtrl = require('../controllers/user')
const ContactCtrl = require('../controllers/contact')
const { catchError } = require('../controllers/error')
const { FILES_PATH } = require('../config/path')

const multer = require('multer')

const router = express.Router()

const fileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, FILES_PATH)
    }
  })

const upload = multer({ storage: fileStorage })

router.post('/', UserCtrl.checkAuth, catchError(ContactCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(ContactCtrl.getAll))

// Get a pull contact info for profile page
router.get('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.get))

// Edit contact by id
router.put('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.edit))

// Remove contact and its all related info (activity, followup) by id
router.delete('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.remove))

// Send Batch email to contact lists
router.post('/batch', UserCtrl.checkAuth, catchError(ContactCtrl.sendBatch))

// Send Batch email to contact lists
router.post('/email', UserCtrl.checkAuth, catchError(ContactCtrl.sendEmail))

// Send Batch email to contact lists
router.post('/import-csv', UserCtrl.checkAuth, upload.single('csv'), catchError(ContactCtrl.importCSV))

module.exports = router
