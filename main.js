const express = require('express');
const bodyParser= require('body-parser');
const path = require('path');
const mysql = require('mysql');
const session = require('express-session')
const MySQLStore = require('express-mysql-session')(session);
const Router = require('./Router');
const winston = require('winston');
const log4js = require('log4js');

//create an express app and configure it with the bodyParser middleware 
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, 'build')));

//set log4js configuration
let date_ob= new Date();
//get the current date
let date = ("0"+ date_ob.getDate()).slice(-2);
//get the current month
let month = ("0"+(date_ob.getMonth()+1)).slice(-2);
//get the current year
let year = date_ob.getFullYear();
//get the current hours
let hours =("0"+date_ob.getHours()).slice(-2);
//get current minutes
let minutes = ("0"+date_ob.getMinutes()).slice(-2);
//get current seconds
let seconds = ("0"+date_ob.getSeconds()).slice(-2);
//print date
const dttw = year+month+date;
let fhh =dttw.toString()
log4js.configure({
    appenders: { fileAppender: {type: 'file', filename: './mpesa_logs/'+fhh+'.log'} },
    categories: { default: { appenders: ['fileAppender'], level: 'info'} }
});

//create logger
const loggerr = log4js.getLogger();

// logger configuration for winston logger
const logConfiguration = {
    'transports': [
        new winston.transports.File({
            filename: '.logs/db_connect.log'
        })
    ]
}
//create logger
const logger = winston.createLogger(logConfiguration);

//Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'eric',
    password:'7treaHunt;',
    database: 'smart'
});

//db connection check
db.connect(function(err){
    if(err){
        loggerr.error(err+ ' Database connection not established')   
    }
    else{
        loggerr.info('Database connected successfully')
    }
});

//routes
new Router(app, db, loggerr);

app.get('/', function(req, res){
    res.sendFile(path.join(__dirname,'build', 'index.html'));
});

//listen
const server = app.listen(3001, (err, live) => {
    if(err){
        console.error(err);
    }
    let host = server.address().address;
    let port = server.address().port;
    console.log('server listening on port', {port} );
});
