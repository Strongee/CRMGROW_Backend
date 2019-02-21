const express = require('express')

const { body, query } = require('express-validator/check')

const UserCtrl = require('../controllers/user')
const { catchError } = require('../controllers/error')

const router = express.Router()

router.post('/'
  , [
    body('email').isEmail(),
    body('user_name').isLength({ min: 3 }).withMessage('user_name must be at least 3 chars long'),
    // password must be at least 5 chars long
    body('password').isLength({ min: 5 }).withMessage('password must be at least 5 chars long'),
    // :TODO phone number regexp should be used
    body('cell_phone').isLength({ min: 9 }).matches(/^[\+\d]?(?:[\d-.\s()]*)$/).withMessage('cell_phone must be a valid phone number!')
  ]
  , catchError(UserCtrl.signUp))

module.exports = router
