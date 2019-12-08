const express = require('express')

const UserCtrl = require('../controllers/user')
const FollowUpCtrl = require('../controllers/follow_up')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(FollowUpCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(FollowUpCtrl.get))
router.get('/date' , UserCtrl.checkAuth, catchError(FollowUpCtrl.getByDate))
router.put('/:id' , UserCtrl.checkAuth, catchError(FollowUpCtrl.edit))
router.post('/checked', UserCtrl.checkAuth, catchError(FollowUpCtrl.updateChecked))
router.post('/archived', UserCtrl.checkAuth, catchError(FollowUpCtrl.updateArchived))
router.post('/update', UserCtrl.checkAuth, catchError(FollowUpCtrl.bulkUpdate))

module.exports = router
