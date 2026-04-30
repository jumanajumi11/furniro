 require('dotenv').config();
 console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);
const express=require('express');
const path=require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
require('./src/config/passport'); 
const nodemailer = require("nodemailer");

const MongoDBStore = require('connect-mongodb-session')(session);

const store = new MongoDBStore({
    uri: 'mongodb://localhost:27017/furnitureDB',
    collection: 'mySessions',
    
    connectionOptions: {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }
});

store.on('error', function(error) {
    console.log("Session Store Error:", error);
});
const app=express()
console.log("EMAIL:", process.env.EMAIL_USER);
console.log("PASS:", process.env.EMAIL_PASS);


const connectDB = require('./src/config/db');

connectDB();



app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/upload', express.static('public/upload')); 
app.use(express.static(path.join(__dirname, 'public')));


const cookieParser = require('cookie-parser');
app.use(cookieParser());


app.use(session({
    secret: 'secretkey',
    resave: false, 
    saveUninitialized: false,
   cookie: {
    maxAge: 1000 * 60 * 10, 
    secure: false,
    httpOnly: true
}
}));
app.use(passport.initialize());
app.use(passport.session());


const userRoutes = require('./src/routes/user');
app.use('/', userRoutes);
const adminRouter = require('./src/routes/admin'); 


app.use('/admin', adminRouter);

app.listen(5000, () => {
  console.log('hello');
});