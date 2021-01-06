const express = require('express');

const UserCtrl = require('../controllers/user');
const DealStageCtrl = require('../controllers/deal_stage');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/',
  UserCtrl.checkAuth,
  UserCtrl.checkSuspended,
  catchError(DealStageCtrl.create)
);
router.get('/', UserCtrl.checkAuth, catchError(DealStageCtrl.getAll));
router.put('/:id', UserCtrl.checkAuth, catchError(DealStageCtrl.edit));
router.delete('/:id', UserCtrl.checkAuth, catchError(DealStageCtrl.remove));

module.exports = router;
