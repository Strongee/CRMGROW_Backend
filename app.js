// // Angular requires Zone.js
// require('zone.js/dist/zone-node')
// const express = require("express");
// const { ngExpressEngine } = require('@nguniversal/express-engine');
// const path = require('path');
// const logger = require('morgan');
// const cookieParser = require('cookie-parser');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const { ENV_PATH } = require('./config/path')
// require('dotenv').config({ path: ENV_PATH })

// const indexRouter = require('./routes/index.js');

// const app = express();

// // import server module bundle
// let { ServerAppModuleNgFactory } = require('./dist-server/main.bundle');

// // set up engine for .html file
// app.engine('html', ngExpressEngine({
//     bootstrap: ServerAppModuleNgFactory
// }));

// app.use(cors())
// app.use(logger('dev'))
// app.use(express.json({limit: '50mb'}))
// app.use(express.urlencoded({ extended: false, limit: '50mb' }))
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(cookieParser())


// app.set('view engine', 'html');
// app.set('views', 'dist-browser');
// // server static files
// app.use(express.static(__dirname + '/dist-browser', { index: false }));

// app.use(express.static('../frontend_admin/dist'));
// app.use('/api', indexRouter)

// // return rendered index.html on every request
// app.get('*', (req, res) => {
//     res.render('index', { req, res });
//     console.log(`new GET request at : ${req.originalUrl}`);
// });

// module.exports = app

let express = require("express");
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const { ENV_PATH } = require('./config/path')
require('dotenv').config({ path: ENV_PATH })

let indexRouter = require('./routes/index.js');
const VideoCtrl = require('./controllers/video')
const { catchError } = require('./controllers/error')

let app = express();

app.use(cors())
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'))
app.use(express.json({limit: '50mb'}))
app.use(express.urlencoded({ extended: false, limit: '50mb' }))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(cookieParser())
app.use(express.static('../frontend_admin/dist'));
app.use(express.static(__dirname + '/public'));


app.get('/', (req, res) => {res.render('index')})
app.get('/video', VideoCtrl.play)

app.use('/api', indexRouter)

app.get((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend_admin/dist', 'index.html'));
});

module.exports = app