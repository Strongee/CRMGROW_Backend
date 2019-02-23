const express = require('express')
const { body, query } = require('express-validator/check')

const UserCtrl = require('../controllers/user')
const FollowUpCtrl = require('../controllers/follow_up')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(FollowUpCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(FollowUpCtrl.getAll))

module.exports = router
