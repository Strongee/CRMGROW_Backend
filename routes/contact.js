const express = require('express')

const UserCtrl = require('../controllers/user')
const ContactCtrl = require('../controllers/contact')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/', UserCtrl.checkAuth, catchError(ContactCtrl.create))
router.get('/' , UserCtrl.checkAuth, catchError(ContactCtrl.getAll))

// Get a pull contact info for profile page
router.get('/:id', UserCtrl.checkAuth, catchError(ContactCtrl.get))

module.exports = router
