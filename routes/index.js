const express = require('express')

const user = require('./user')
const follow_up = require('./follow_up')
const UserCtrl = require('../controllers/user')

const router = express.Router()

router.get('/health', (req, res) => {
    res.send('OK')
  })

// Admin Dashboard api
router.use('/user', user)
router.use('/follow', follow_up)

module.exports = router