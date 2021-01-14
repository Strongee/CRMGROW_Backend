const express = require('express');

const UserCtrl = require('../controllers/user');
const DealCtrl = require('../controllers/deal');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DealCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(DealCtrl.getAll));
router.delete('/:id', UserCtrl.checkAuth, catchError(DealCtrl.remove));
router.put('/:id', UserCtrl.checkAuth, catchError(DealCtrl.edit));
router.post(
  '/move-deal',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DealCtrl.moveDeal)
);
router.get('/:id', UserCtrl.checkAuth, catchError(DealCtrl.getDetail));

module.exports = router;
