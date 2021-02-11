const express = require('express');

const UserCtrl = require('../controllers/user');
const DealCtrl = require('../controllers/deal');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DealCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(DealCtrl.getAll));

router.post(
  '/get-activity',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getActivity)
);
router.post('/add-note', UserCtrl.checkAuth, catchError(DealCtrl.createNote));

router.post('/get-note', UserCtrl.checkAuth, catchError(DealCtrl.getNotes));
router.post(
  '/add-follow',
  UserCtrl.checkAuth,
  catchError(DealCtrl.createFollowUp)
);
router.post(
  '/get-follow',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getFollowup)
);

router.post(
  '/move-deal',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DealCtrl.moveDeal)
);

router.post('/send-email', UserCtrl.checkAuth, catchError(DealCtrl.sendEmail));
router.post('/get-email', UserCtrl.checkAuth, catchError(DealCtrl.getEmails));

router.post(
  '/create-appointment',
  UserCtrl.checkAuth,
  catchError(DealCtrl.createAppointment)
);
router.post(
  '/get-appointments',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getAppointments)
);

router.post(
  '/create-team-call',
  UserCtrl.checkAuth,
  catchError(DealCtrl.createTeamCall)
);
router.post(
  '/get-team-calls',
  UserCtrl.checkAuth,
  catchError(DealCtrl.getTeamCalls)
);

router.post(
  '/update-contact/:id',
  UserCtrl.checkAuth,
  catchError(DealCtrl.updateContact)
);

router.delete('/:id', UserCtrl.checkAuth, catchError(DealCtrl.remove));
router.put('/:id', UserCtrl.checkAuth, catchError(DealCtrl.edit));
router.get('/:id', UserCtrl.checkAuth, catchError(DealCtrl.getDetail));

module.exports = router;
