const express = require('express')

const UserCtrl = require('../controllers/user')
const SMSCtrl = require('../controllers/sms')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/receive/:id', catchError(SMSCtrl.receive))
router.post('/reply/:id', catchError(SMSCtrl.reply))
router.post('/send/:id' , UserCtrl.checkAuth, catchError(SMSCtrl.send))

module.exports = router