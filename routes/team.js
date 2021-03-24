const express = require('express');

const UserCtrl = require('../controllers/user');
const TeamCtrl = require('../controllers/team');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(TeamCtrl.create));
router.get('/load', UserCtrl.checkAuth, catchError(TeamCtrl.getAll));
router.get(
  '/load-leaders',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getLeaders)
);
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

router.get('/call', UserCtrl.checkAuth, catchError(TeamCtrl.getInquireCall));

router.get(
  '/nth-call/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getInquireCall)
);

router.get(
  '/call/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getDetailInquireCall)
);

router.get(
  '/call-planned',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getPlannedCall)
);
router.get(
  '/call-planned/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getPlannedCall)
);

router.get(
  '/call-finished',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getFinishedCall)
);
router.get(
  '/call-finished/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getFinishedCall)
);

router.post(
  '/shared-contacts',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.getSharedContacts)
);

router.post(
  '/search-contact',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.searchContact)
);

router.post(
  '/request-call',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.requestCall)
);

router.post(
  '/accept-call',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.acceptCall)
);

router.post(
  '/reject-call',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.rejectCall)
);

router.put('/call/:id', UserCtrl.checkAuth, catchError(TeamCtrl.updateCall));
router.delete('/call/:id', UserCtrl.checkAuth, catchError(TeamCtrl.removeCall));
router.delete('/call', UserCtrl.checkAuth, catchError(TeamCtrl.removeCall));
router.get(
  '/material/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.loadMaterial)
);
router.get(
  '/automation/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.loadAutomation)
);
router.get(
  '/template/:id',
  UserCtrl.checkAuth,
  catchError(TeamCtrl.loadTemplate)
);
router.put('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.update));
router.get('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.get));
router.delete('/:id', UserCtrl.checkAuth, catchError(TeamCtrl.remove));
router.post('/load-call', UserCtrl.checkAuth, catchError(TeamCtrl.loadCalls));

module.exports = router;
