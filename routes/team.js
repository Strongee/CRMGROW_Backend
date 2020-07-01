const express = require('express');

const UserCtrl = require('../controllers/user');
const TeamCtrl = require('../controllers/team');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(TeamCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(TeamCtrl.get));
router.get('/referrals', UserCtrl.checkAuth, catchError(TeamCtrl.getAll));
router.put('/', UserCtrl.checkAuth, catchError(TeamCtrl.update));

module.exports = router;
