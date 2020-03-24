const express = require('express')

const UserCtrl = require('../controllers/user')
const PageCtrl = require('../controllers/page')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(PageCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(TagCtrl.get))
router.post('/search', UserCtrl.checkAuth, catchError(TagCtrl.search))
router.get('/getAll', UserCtrl.checkAuth2, catchError(TagCtrl.getAll))

module.exports = router
