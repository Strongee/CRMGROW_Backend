const express = require('express');

const UserCtrl = require('../controllers/user');
const TemplateCtrl = require('../controllers/email_template');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/create', UserCtrl.checkAuth, catchError(TemplateCtrl.create));
router.get('/:id', UserCtrl.checkAuth, catchError(TemplateCtrl.get));
router.put('/:id', UserCtrl.checkAuth, catchError(TemplateCtrl.update));
router.delete('/:id', UserCtrl.checkAuth, catchError(TemplateCtrl.remove));
router.post(
  '/list/:page',
  UserCtrl.checkAuth,
  catchError(TemplateCtrl.getTemplates)
);
router.post('/delete', UserCtrl.checkAuth, catchError(TemplateCtrl.bulkRemove));
router.post('/search', UserCtrl.checkAuth, catchError(TemplateCtrl.search));

// router.get('/receive' , UserCtrl.checkAuth, catchError(EmailCtrl.receive))

module.exports = router;
