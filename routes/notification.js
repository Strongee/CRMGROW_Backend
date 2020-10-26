const express = require('express');

const UserCtrl = require('../controllers/user');
const NotificationCtrl = require('../controllers/notification');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.get('/', UserCtrl.checkAuth2, catchError(NotificationCtrl.get));
router.get(
  '/get-delivery',
  UserCtrl.checkAuth2,
  catchError(NotificationCtrl.getDelivery)
);
router.post(
  '/bulk-read',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.bulkRead)
);
router.post(
  '/bulk-unread',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.bulkUnread)
);
router.post(
  '/bulk-remove',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.bulkRemove)
);

router.get(
  '/list/:page',
  UserCtrl.checkAuth,
  catchError(NotificationCtrl.getPage)
);

module.exports = router;
