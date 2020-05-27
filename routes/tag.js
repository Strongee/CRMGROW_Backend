const express = require('express');

const UserCtrl = require('../controllers/user');
const TagCtrl = require('../controllers/tag');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(TagCtrl.create));
router.get('/', UserCtrl.checkAuth, catchError(TagCtrl.get));
router.post('/search', UserCtrl.checkAuth, catchError(TagCtrl.search));
router.get('/getAll', UserCtrl.checkAuth2, catchError(TagCtrl.getAll));

module.exports = router;
