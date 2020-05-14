const express = require('express')

const UserCtrl = require('../controllers/user')
const GuestCtrl = require('../controllers/guest')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(GuestCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(GuestCtrl.get))
router.put('/', UserCtrl.checkAuth, catchError(GuestCtrl.edit))

module.exports = router
