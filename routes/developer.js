const express = require('express');

const UserCtrl = require('../controllers/user');
const DeveloperCtrl = require('../controllers/developer');
const ContactCtrl = require('../controllers/contact');
const FollowUpCtrl = require('../controllers/follow_up');
const NoteCtrl = require('../controllers/note');
const TimeLineCtrl = require('../controllers/time_line');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/contact',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DeveloperCtrl.addContact)
);
router.get(
  '/contact',
  UserCtrl.checkAuth,
  catchError(DeveloperCtrl.getContact)
);
router.get(
  '/automation',
  UserCtrl.checkAuth,
  catchError(DeveloperCtrl.getAutomations)
);
router.get('/label', UserCtrl.checkAuth, catchError(DeveloperCtrl.getLabels));
router.put(
  '/contact',
  UserCtrl.checkAuth,
  DeveloperCtrl.searchContact,
  catchError(ContactCtrl.edit)
);
router.post(
  '/automation',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  DeveloperCtrl.searchContact,
  catchError(TimeLineCtrl.recreate)
);
router.post(
  '/followup',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  DeveloperCtrl.searchContact,
  catchError(FollowUpCtrl.create)
);
router.post(
  '/note',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  DeveloperCtrl.searchContact,
  catchError(NoteCtrl.create)
);

module.exports = router;
