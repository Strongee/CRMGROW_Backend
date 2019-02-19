let http = require("http");  //1
let url = require("url");  //2
let express = require("express");
const path = require('path');
let consolidate = require('consolidate');
let handlebars = require('handlebars');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
let mongoose = require('mongoose');

const { DB_PORT } = require('./config/database');

let indexRouter = require('./routes/index.js');

let app = express();

app.use(cors())
app.use(logger('dev'))
app.use(express.json({limit: '50mb'}))
app.use(express.urlencoded({ extended: false, limit: '50mb' }))
app.use(cookieParser())

app.use('/api', indexRouter)

mongoose
  .connect(DB_PORT)
  .then(() => {
    console.log('Connection has been established successfully.')
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err)
  })


let portNumber = process.argv[2] || 3000

http.createServer(app).listen(portNumber, function(){
	console.log('Server listening at port '+ portNumber);
})