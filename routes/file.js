const express = require('express')
const uuidv1 = require('uuid/v1')
const mime = require('mime-types')

const FileCtrl = require('../controllers/file')
const Users = require('../controllers/user')
const { catchError } = require('../controllers/error')

const multer = require('multer')

const router = express.Router()

const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './files/')
  },
  filename: (req, file, cb) => {
    cb(null, uuidv1() + '.' + mime.extension(file.mimetype))
  }
})


const upload = multer({ storage: fileStorage })


// Upload a file
router.post('/', Users.checkAuthOptional, upload.single('file'), catchError(FileCtrl.create))

// Get a file
router.get('/:id', catchError(FileCtrl.get))

// Delete a file
router.delete('/:id', Users.checkAuth, catchError(FileCtrl.remove))


module.exports = router
