const express = require('express');

const UserCtrl = require('../controllers/user');
const MaterialCtrl = require('../controllers/tracker');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/social-share', catchError(MaterialCtrl.socialShare));
router.post('/thumbs-up', catchError(MaterialCtrl.thumbsUp));

module.exports = router;
