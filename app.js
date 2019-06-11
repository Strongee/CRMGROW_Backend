let express = require("express");
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const { ENV_PATH } = require('./config/path')
require('dotenv').config({ path: ENV_PATH })

let indexRouter = require('./routes/index.js');

let app = express();

app.use(cors())
app.use(logger('dev'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(express.static('../frontend_admin/dist'));
app.use('/api', indexRouter)


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend_admin/dist', 'index.html'));
});

module.exports = app