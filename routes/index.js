const express = require('express')

const user = require('./user')
const follow_up = require('./follow_up')
const contact = require('./contact')
const activity = require('./activity')
const note = require('./note')
const phone_log = require('./phone_log')
const appointment = require('./appointment')
const tag = require('./tag')
const file = require('./file')
const video = require('./video')
const video_tracker = require('./video_tracker')
const pdf = require('./pdf')
const pdf_tracker = require('./pdf_tracker')
const admin = require('./admin/index')
const UserCtrl = require('../controllers/user')

const router = express.Router()

router.get('/health', (req, res) => {
    res.send('OK')
  })

// User Dashboard api
router.use('/user', user)
router.use('/follow', follow_up)
router.use('/contact', contact)
router.use('/activity', activity)
router.use('/note', note)
router.use('/phone', phone_log)
router.use('/appointment', appointment)
router.use('/tag', tag)
router.use('/file', file)
router.use('/video', video)
router.use('/vtrack', video_tracker)
router.use('/pdf', pdf)
router.use('/ptrack', pdf_tracker)
router.use('/admin', admin)

module.exports = router