const express = require('express');

const UserCtrl = require('../controllers/user');
const TextCtrl = require('../controllers/text');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/receive', catchError(TextCtrl.receive));
router.post('/receive1', catchError(TextCtrl.receive1));
router.post('/receive-signalwire', catchError(TextCtrl.receiveTextSignalWire));
router.post('/receive-twilio', catchError(TextCtrl.receiveTextTwilio));
router.post('/send/:id', UserCtrl.checkAuth, catchError(TextCtrl.send));

module.exports = router;