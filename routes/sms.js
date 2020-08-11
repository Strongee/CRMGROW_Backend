const express = require('express');

const UserCtrl = require('../controllers/user');
const SMSCtrl = require('../controllers/sms');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/receive', catchError(SMSCtrl.receive));
router.post('/receive1', catchError(SMSCtrl.receive1));
router.post('/send/:id', UserCtrl.checkAuth, catchError(SMSCtrl.send));

module.exports = router;
