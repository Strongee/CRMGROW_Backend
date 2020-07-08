const express = require('express');

const UserCtrl = require('../controllers/user');
const TeamCtrl = require('../controllers/team');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(TeamCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(TeamCtrl.getAll));

router.post(
  '/bulk-invite',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.bulkInvites)
);
router.post(
  '/accept/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.acceptInviation)
);
router.post(
  '/share-videos',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareVideos)
);
router.post('/share-pdfs', UserCtrl.checkAuth, catchError(TeamCtrl.sharePdfs));
router.post(
  '/share-images',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareImages)
);
router.post(
  '/share-automations',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareAutomations)
);
router.post(
  '/share-templates',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.shareEmailTemplates)
);
router.post(
  '/search-user',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.searchUser)
);

router.put('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.update));
router.get('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.get));

module.exports = router;
