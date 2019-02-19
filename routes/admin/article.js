const express = require('express')

const { body, validationResult } = require('express-validator/check')

const UserCtrl = require('../../controllers/user')
const ArticleCtrl = require('../../controllers/article')
const { catchError } = require('../../controllers/error')

const router = express.Router()

// Create a new cateogry
router.post('/', UserCtrl.checkAuth, catchError(ArticleCtrl.insert))

// Get a single category
router.get('/index', UserCtrl.checkAuth, catchError(ArticleCtrl.get))

// Vote a single category
router.post('/:id/vote', UserCtrl.checkAuth, catchError(ArticleCtrl.vote))

// Cancel Vote a single category
router.put('/:id', UserCtrl.checkAuth, catchError(ArticleCtrl.update))

// Get a single category
router.get('/', UserCtrl.checkAuth, catchError(ArticleCtrl.getAll))

module.exports = router