const express = require('express')

const { body, query } = require('express-validator/check')

const UserCtrl = require('../../controllers/admin/user')
const { catchError } = require('../../controllers/error')

const router = express.Router()

// SignUp
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

// Login 
router.post('/login', [
    body('email').optional().isLength({ min: 3 }),
    body('user_name').optional().isLength({ min: 3 }),
    body('password').isLength({ min: 1 })
  ], catchError(UserCtrl.login))  
  
// Get own profile
router.get('/me', UserCtrl.checkAuth, catchError(UserCtrl.editMe))

// Edit own profile
router.put('/me', UserCtrl.checkAuth, catchError(UserCtrl.editMe))

// Edit own profile
router.get('/', UserCtrl.checkAuth, catchError(UserCtrl.getAll))

// New Password by old one
router.post('/new-password', UserCtrl.checkAuth, [ body('old_password').isLength({ min: 5}), body('new_password').isLength({ min: 5 }) ], catchError(UserCtrl.resetPasswordByOld))

module.exports = router
