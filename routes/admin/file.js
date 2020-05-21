const express = require('express');
const uuidv1 = require('uuid/v1');
const mime = require('mime-types');

const FileCtrl = require('../../controllers/file');
const UserCtrl = require('../../controllers/user');
const { catchError } = require('../../controllers/error');
const { FILES_PATH } = require('../../config/path');

const multer = require('multer');

const router = express.Router();

const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, FILES_PATH);
  },
  filename: (req, file, cb) => {
    cb(null, uuidv1() + '.' + mime.extension(file.mimetype));
  },
});

const upload = multer({ storage: fileStorage });

// Upload a file
router.post(
  '/',
  UserCtrl.checkAuth,
  upload.single('photo'),
  catchError(FileCtrl.create)
);

// Get a file
router.get('/:name', catchError(FileCtrl.get));

// Delete a file
router.delete('/:id', UserCtrl.checkAuth, catchError(FileCtrl.remove));

module.exports = router;
