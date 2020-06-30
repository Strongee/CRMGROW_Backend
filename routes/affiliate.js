const express = require('express');

const UserCtrl = require('../controllers/user');
const AffiliateCtrl = require('../controllers/affiliate');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(AffiliateCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(AffiliateCtrl.get));
router.get('/referrals', UserCtrl.checkAuth, catchError(AffiliateCtrl.getAll));
router.put('/', UserCtrl.checkAuth, catchError(AffiliateCtrl.update));

module.exports = router;
