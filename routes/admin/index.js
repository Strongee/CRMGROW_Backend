const express = require('express')
const path = require('path')

const UserCtrl = require('../../controllers/user')
const article = require('./article')


const router = express.Router()

// Admin Dashboard api
router.use('/article', article)


// Admin Dashboard view
router.get('*', UserCtrl.checkAdmin, function(req, res){
    res.sendFile(path.join(__dirname, '../../views', 'admin.html'));
})




module.exports = router