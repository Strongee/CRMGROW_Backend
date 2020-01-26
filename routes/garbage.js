const express = require('express')

const UserCtrl = require('../controllers/user')
const GarbageCtrl = require('../controllers/garbage')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(GarbageCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(GarbageCtrl.get))
router.put('/', UserCtrl.checkAuth, catchError(GarbageCtrl.edit))

module.exports = router
