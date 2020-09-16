const express = require('express');

const UserCtrl = require('../controllers/user');
const MaterialThemeCtrl = require('../controllers/material_theme');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.getAll));
router.post('/:id', UserCtrl.checkAuth, catchError(MaterialThemeCtrl.get));

module.exports = router;
