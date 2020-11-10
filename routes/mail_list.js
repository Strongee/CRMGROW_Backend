const express = require('express');

const UserCtrl = require('../controllers/user');
const MailListCtrl = require('../controllers/mail_list');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(MailListCtrl.create)
);

router.get('/', UserCtrl.checkAuth, catchError(MailListCtrl.getAll));
router.get('/:id', UserCtrl.checkAuth, catchError(MailListCtrl.get));

module.exports = router;
