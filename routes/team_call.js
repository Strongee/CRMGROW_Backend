const express = require('express');

const UserCtrl = require('../controllers/user');
const TeamCtrl = require('../controllers/team');
const { catchError } = require('../controllers/error');

const router = express.Router();

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

router.post('/load-call', UserCtrl.checkAuth, catchError(TeamCtrl.loadCalls));

module.exports = router;
