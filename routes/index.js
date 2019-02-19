const express = require('express')

const admin = require('./admin/index')
const router = express()

router.use('/admin', admin)

module.exports = router 