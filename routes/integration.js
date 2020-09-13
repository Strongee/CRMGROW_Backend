const express = require('express');

const UserCtrl = require('../controllers/user');
const IntegrationCtrl = require('../controllers/integration');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post(
  '/calendly/check-auth',
  UserCtrl.checkAuth,
  catchError(IntegrationCtrl.checkAuthCalendly)
);
router.get(
  '/calendly',
  UserCtrl.checkAuth,
  catchError(IntegrationCtrl.getCalendly)
);
router.post(
  '/calendly/set-event',
  UserCtrl.checkAuth,
  catchError(IntegrationCtrl.setEventCalendly)
);

module.exports = router;
