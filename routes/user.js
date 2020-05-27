const express = require('express');

const { body, query } = require('express-validator/check');

const UserCtrl = require('../controllers/user');
const { catchError } = require('../controllers/error');

const router = express.Router();

// SignUp
router.post(
  '/',
  [
    body('email').isEmail(),
    body('user_name')
      .isLength({ min: 3 })
      .withMessage('user_name must be at least 3 chars long'),
    // password must be at least 5 chars long
    body('password')
      .isLength({ min: 5 })
      .withMessage('password must be at least 5 chars long'),
    // :TODO phone number regexp should be used
    body('cell_phone')
      .isLength({ min: 9 })
      .matches(/^[\+\d]?(?:[\d-.\s()]*)$/)
      .withMessage('cell_phone must be a valid phone number!'),
  ],
  catchError(UserCtrl.signUp)
);

// Login
router.post(
  '/login',
  [
    body('email').optional().isLength({ min: 3 }),
    body('user_name').optional().isLength({ min: 3 }),
    body('password').isLength({ min: 1 }),
  ],
  catchError(UserCtrl.login)
);

router.post('/check', catchError(UserCtrl.checkUser));

router.post('/logout', UserCtrl.checkAuth, catchError(UserCtrl.logout));

// Edit own profile
router.get('/me', UserCtrl.checkAuth2, catchError(UserCtrl.getMe));

// Edit own profile
router.put('/me', UserCtrl.checkAuth, catchError(UserCtrl.editMe));

// New Password by old one
router.post(
  '/new-password',
  UserCtrl.checkAuth,
  [
    body('old_password').isLength({ min: 5 }),
    body('new_password').isLength({ min: 5 }),
  ],
  catchError(UserCtrl.resetPasswordByOld)
);

// Forgot password
router.post('/forgot-password', catchError(UserCtrl.forgotPassword));

// Rest own profile
router.post('/reset-password', catchError(UserCtrl.resetPasswordByCode));

// Synchronize with outlook email
router.get(
  '/sync-outlook',
  UserCtrl.checkAuth2,
  catchError(UserCtrl.syncOutlook)
);

// Synchronize with gmail
router.get('/sync-gmail', UserCtrl.checkAuth2, catchError(UserCtrl.syncGmail));

// Disconnect with gmail
router.get(
  '/discon-gmail',
  UserCtrl.checkAuth2,
  catchError(UserCtrl.disconnectGmail)
);

// Synchronize with yahoo
router.get('/sync-yahoo', UserCtrl.checkAuth2, catchError(UserCtrl.syncYahoo));

// Outlook Email authorization
router.get(
  '/authorize-outlook',
  UserCtrl.checkAuth2,
  catchError(UserCtrl.authorizeOutlook)
);

// Gmail authorized
router.get(
  '/authorize-gmail',
  UserCtrl.checkAuth2,
  catchError(UserCtrl.authorizeGmail)
);

// Yahoo authorized
router.get(
  '/authorize-yahoo',
  UserCtrl.checkAuth2,
  catchError(UserCtrl.authorizeYahoo)
);

// Synchronize calendar with connected outlook email
router.get(
  '/sync-calendar',
  UserCtrl.checkAuth,
  catchError(UserCtrl.syncCalendar)
);

// Synchronize calendar with connected outlook email
router.get(
  '/discon-calendar',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconCalendar)
);

// Daily Report
router.get(
  '/daily-report',
  UserCtrl.checkAuth,
  catchError(UserCtrl.dailyReport)
);

// Disconnect Daily Report
router.get(
  '/discon-daily',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconDaily)
);

// Daily Report
router.get(
  '/weekly-report',
  UserCtrl.checkAuth,
  catchError(UserCtrl.weeklyReport)
);

// Disconnect Weekly Report
router.get(
  '/discon-weekly',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconWeekly)
);

// Desktop Notification
router.post(
  '/desktop-notification',
  UserCtrl.checkAuth2,
  catchError(UserCtrl.desktopNotification)
);

// Disconnect Desktop Notification
router.get(
  '/discon-desktop',
  UserCtrl.checkAuth,
  catchError(UserCtrl.disconDesktop)
);

// Text Notification
router.get(
  '/text-notification',
  UserCtrl.checkAuth,
  catchError(UserCtrl.textNotification)
);

// Disconnect Desktop Notification
router.get('/discon-text', UserCtrl.checkAuth, catchError(UserCtrl.disconText));

// Signup Gmail
router.get('/signup-gmail', catchError(UserCtrl.signUpGmail));

// Signup Outlook
router.get('/signup-outlook', catchError(UserCtrl.signUpOutlook));

// Social google profile
router.get('/social-gmail', catchError(UserCtrl.socialGmail));

// Edit outlook profile
router.get('/social-outlook', catchError(UserCtrl.socialOutlook));

// Edit own profile
router.post('/social-login', catchError(UserCtrl.socialLogin));

// Edit own profile
router.post('/social-signup', catchError(UserCtrl.socialSignUp));

// Connect Another Email Service
router.get(
  '/another-con',
  UserCtrl.checkAuth2,
  catchError(UserCtrl.connectAnotherEmail)
);

// Search user email
router.post('/search-email', catchError(UserCtrl.searchUserEmail));

// Search nickname
router.post('/search-nickname', catchError(UserCtrl.searchNickName));

// Search Phonenumber
router.post('/search-phone', catchError(UserCtrl.searchPhone));

// Edit own profile
router.get('/:id', catchError(UserCtrl.getUser));

module.exports = router;
