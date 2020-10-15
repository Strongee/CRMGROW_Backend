const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const { ENV_PATH } = require('./config/path');
require('dotenv').config();

const indexRouter = require('./routes/index.js');
const VideoCtrl = require('./controllers/video');
const PDFCtrl = require('./controllers/pdf');
const ImageCtrl = require('./controllers/image');
const PageCtrl = require('./controllers/page');
const EmailCtrl = require('./controllers/email');
const { catchError } = require('./controllers/error');

const app = express();

app.use(cors());
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static('../frontend/dist'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/video', catchError(VideoCtrl.play));
app.get('/video1/:id', catchError(VideoCtrl.play1));
app.get('/video2', catchError(VideoCtrl.play2));
app.get('/pdf', catchError(PDFCtrl.play));
app.get('/pdf1/:id', catchError(PDFCtrl.play1));
app.get('/image', catchError(ImageCtrl.play));
app.get('/image/:id', catchError(ImageCtrl.play1));
app.get('/embed/video/:video', catchError(VideoCtrl.embedPlay));
app.get('/unsubscribe', catchError(EmailCtrl.unSubscribePage));
app.get('/redirect', catchError(EmailCtrl.clickEmailLink));
app.get('/google-oauth-callback', (req, res) => {
  res.render('google_oauth_callback');
});
app.get('/outlook-oauth-callback', (req, res) => {
  res.render('outlook_oauth_callback');
});

app.get('/auth', (req, res) => {
  res.render('auth');
});

app.use('/api', indexRouter);
app.get('*', catchError(PageCtrl.display), (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

module.exports = app;
