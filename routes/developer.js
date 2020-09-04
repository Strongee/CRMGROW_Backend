const express = require('express');

const UserCtrl = require('../controllers/user');
const DeveloperCtrl = require('../controllers/developer');
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
router.put(
  '/conatct',
  UserCtrl.checkAuth,
  catchError(DeveloperCtrl.updateContact)
);

module.exports = router;
