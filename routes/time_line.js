const express = require('express')

const UserCtrl = require('../controllers/user')
const TimeLineCtrl = require('../controllers/time_line')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/create', UserCtrl.checkAuth, catchError(TimeLineCtrl.create))

module.exports = router
