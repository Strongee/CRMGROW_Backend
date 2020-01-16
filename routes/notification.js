const express = require('express')

const UserCtrl = require('../controllers/user')
const NotificationCtrl = require('../controllers/notification')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.get('/' , UserCtrl.checkAuth, catchError(NotificationCtrl.get))

module.exports = router
