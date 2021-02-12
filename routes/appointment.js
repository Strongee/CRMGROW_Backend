const express = require('express');

const UserCtrl = require('../controllers/user');
const AppointmentCtrl = require('../controllers/appointment');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(AppointmentCtrl.create));

router.get('/', UserCtrl.checkAuth, catchError(AppointmentCtrl.getAll));

// Update appointment by id
router.put('/:id', UserCtrl.checkAuth, catchError(AppointmentCtrl.edit));

// Update appointment by id
router.post('/accept', catchError(AppointmentCtrl.accept));

// Update appointment by id
router.post('/decline', catchError(AppointmentCtrl.decline));

// Get calendar list
router.get(
  '/calendar',
  UserCtrl.checkAuth,
  catchError(AppointmentCtrl.getCalendarList)
);

// Remove contact and its all related info (activity, followup) by id
router.post('/delete', UserCtrl.checkAuth, catchError(AppointmentCtrl.remove));

router.get('/:id', UserCtrl.checkAuth, catchError(AppointmentCtrl.get));

module.exports = router;
