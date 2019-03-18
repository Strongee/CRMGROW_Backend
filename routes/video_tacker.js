const express = require('express')

const UserCtrl = require('../controllers/user')
const VideoTrackerCtrl = require('../controllers/video_tacker')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(VideoTrackerCtrl.create))
router.get('/:contact' , UserCtrl.checkAuth, catchError(VideoTrackerCtrl.get))

module.exports = router