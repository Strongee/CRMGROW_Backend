const express = require('express')

const UserCtrl = require('../controllers/user')
const AppointmentCtrl = require('../controllers/appointment')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(AppointmentCtrl.create))
router.get('/:contact' , UserCtrl.checkAuth, catchError(AppointmentCtrl.get))

module.exports = router
