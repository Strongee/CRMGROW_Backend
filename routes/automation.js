const express = require('express');

const UserCtrl = require('../controllers/user');
const AutomationCtrl = require('../controllers/automation');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/search', UserCtrl.checkAuth, catchError(AutomationCtrl.search));

router.post('/', UserCtrl.checkAuth, catchError(AutomationCtrl.create));

router.put('/:id', UserCtrl.checkAuth, catchError(AutomationCtrl.update));

router.delete('/:id', UserCtrl.checkAuth, catchError(AutomationCtrl.remove));

router.get(
  '/list/:page',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getPage)
);

router.post(
  '/detail/:id',
  UserCtrl.checkAuth,
  catchError(AutomationCtrl.getStatus)
);

router.get('/:id', UserCtrl.checkAuth, catchError(AutomationCtrl.get));

// Default Video Edit
router.post(
  '/update-admin',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(AutomationCtrl.updateDefault)
);

module.exports = router;
