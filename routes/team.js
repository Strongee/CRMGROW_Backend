const express = require('express');

const UserCtrl = require('../controllers/user');
const TeamCtrl = require('../controllers/team');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(TeamCtrl.create));
router.get('/load', UserCtrl.checkAuth, catchError(TeamCtrl.getAll));
router.get(
  '/load-invited',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getInvitedTeam)
);
router.get('/user/:id', UserCtrl.checkAuth, catchError(TeamCtrl.getTeam));
router.post('/request', UserCtrl.checkAuth, catchError(TeamCtrl.requestTeam));

router.post(
  '/bulk-invite/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.bulkInvites)
);

router.post(
  '/accept/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.acceptInviation)
);

router.post(
  '/admin-accept',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.acceptRequest)
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
  '/remove-videos/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeVideos)
);
router.post(
  '/remove-pdfs/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removePdfs)
);
router.post(
  '/remove-images/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeImages)
);
router.post(
  '/remove-templates/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeEmailTemplates)
);
router.post(
  '/remove-automations/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.removeAutomations)
);
router.post(
  '/search-user',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.searchUser)
);
router.post('/update', UserCtrl.checkAuth, catchError(TeamCtrl.updateTeam));

// Team call for 3 way
router.get(
  '/call-invite',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getTeamCall)
);
router.get(
  '/call-request',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getRequestedCall)
);
router.post(
  '/request-call',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.requestCall)
);
router.post('/join-call', UserCtrl.checkAuth, catchError(TeamCtrl.acceptCall));

router.put('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.update));
router.get('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.get));
router.delete('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.remove));

module.exports = router;
