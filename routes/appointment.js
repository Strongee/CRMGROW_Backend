const express = require('express')

const UserCtrl = require('../controllers/user')
const AppointmentCtrl = require('../controllers/appointment')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(AppointmentCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(AppointmentCtrl.get))

// Update appointment by id
router.put('/:id' , UserCtrl.checkAuth, catchError(AppointmentCtrl.edit))


// Remove contact and its all related info (activity, followup) by id
router.delete('/:id', UserCtrl.checkAuth, catchError(AppointmentCtrl.remove))

module.exports = router
