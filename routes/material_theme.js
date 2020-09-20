const express = require('express');

const UserCtrl = require('../controllers/user');
const MaterialThemeCtrl = require('../controllers/material_theme');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.get('/', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.getAll));
router.get('/:id', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.get));
router.post('/', UserCtrl.checkAuth, MaterialThemeCtrl.create);

module.exports = router;
