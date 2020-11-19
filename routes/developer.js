const express = require('express');

const UserCtrl = require('../controllers/user');
const DeveloperCtrl = require('../controllers/developer');
const ContactCtrl = require('../controllers/contact');
const FollowUpCtrl = require('../controllers/follow_up');
const EmailTemplateCtrl = require('../controllers/email_template');
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
router.get('/video', UserCtrl.checkAuth, catchError(DeveloperCtrl.getVideos));
router.get('/pdf', UserCtrl.checkAuth, catchError(DeveloperCtrl.getPdfs));
router.get('/image', UserCtrl.checkAuth, catchError(DeveloperCtrl.getImages));
router.get('/label', UserCtrl.checkAuth, catchError(DeveloperCtrl.getLabels));
router.get(
  '/automation',
  UserCtrl.checkAuth,
  catchError(DeveloperCtrl.getAutomations)
);
router.get(
  '/template',
  UserCtrl.checkAuth,
  catchError(DeveloperCtrl.getEmailTemplates)
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
router.post('/tag', UserCtrl.checkAuth, catchError(DeveloperCtrl.addNewTag));
module.exports = router;
