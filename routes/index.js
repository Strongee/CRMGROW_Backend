const express = require('express')

const user = require('./user')
const follow_up = require('./follow_up')
const contact = require('./contact')
const activity = require('./activity')
const note = require('./note')
const tag = require('./tag')
const UserCtrl = require('../controllers/user')

const router = express.Router()

router.get('/health', (req, res) => {
    res.send('OK')
  })

// Admin Dashboard api
router.use('/user', user)
router.use('/follow', follow_up)
router.use('/contact', contact)
router.use('/activity', activity)
router.use('/note', note)
router.use('/tag', tag)

module.exports = router