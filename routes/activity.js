const express = require('express')

const UserCtrl = require('../controllers/user')
const ActivityCtrl = require('../controllers/activity')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/remove-all', UserCtrl.checkAuth, catchError(ActivityCtrl.removeAll))
router.post('/remove', UserCtrl.checkAuth, catchError(ActivityCtrl.removeBulk))
router.post('/', UserCtrl.checkAuth, catchError(ActivityCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(ActivityCtrl.get))
router.get('/:id', UserCtrl.checkAuth, UserCtrl.checkLastLogin , catchError(ActivityCtrl.get))

module.exports = router
