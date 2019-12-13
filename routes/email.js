const express = require('express')

const UserCtrl = require('../controllers/user')
const EmailCtrl = require('../controllers/email')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, UserCtrl.checkSuspended, catchError(EmailCtrl.send))
router.get('/receive' , UserCtrl.checkAuth, catchError(EmailCtrl.receive))

module.exports = router
