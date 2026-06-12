import dotenv from 'dotenv';
dotenv.config();

console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);

import express from 'express';
import path from 'path';
import mongoose from 'mongoose';
import session from 'express-session';
import passport from 'passport';
import nocache from 'nocache';
import cookieParser from 'cookie-parser';
import MongoStore from 'connect-mongo';
import { fileURLToPath } from 'url';

import './src/config/passport.js';

import connectDB from './src/config/db.js';

import adminRoutes from './src/routes/admin.js';
import userRoutes from './src/routes/user.js';
import { seedProductsIfEmpty } from './src/services/product/seed.service.js';
import Cart from './src/models/cart.js';
import Category from './src/models/category.js';
import wishlistService from './src/services/user/wishlist.service.js';
import { formatCurrency } from './src/utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

console.log("EMAIL:", process.env.EMAIL_USER);
console.log("PASS:", process.env.EMAIL_PASS);

connectDB().then(() => {
    seedProductsIfEmpty();
});

app.use(nocache());

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/upload', express.static('public/upload'));
app.use('/upload/products', express.static('public/upload/products'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());


// ADMIN SESSION
const adminSession = session({
    name: 'admin.sid',
    secret: 'admin-secret-key',
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl:
            process.env.MONGODB_URI ||
            'mongodb://localhost:27017/furniture_db',

        collectionName: 'admin_sessions'
    }),

    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: false,
        httpOnly: true
    }
});


// USER SESSION
const userSession = session({
    name: 'user.sid',
    secret: 'user-secret-key',
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl:
            process.env.MONGODB_URI ||
            'mongodb://localhost:27017/furniture_db',

        collectionName: 'user_sessions'
    }),

    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: false,
        httpOnly: true
    }
});


// ADMIN ROUTES
app.use('/admin', adminSession, adminRoutes);


// USER ROUTES
app.use(
    '/',
    userSession,
    passport.initialize(),
    passport.session(),
    async (req, res, next) => {
        res.locals.formatCurrency = formatCurrency;
        res.locals.cartCount = 0;
        res.locals.wishlistCount = 0;
        res.locals.wishlistProductIds = [];
        res.locals.navbarCategories = [];
        res.locals.selectedCategory = req.query.category || '';

        try {
            const categories = await Category.find({ isDeleted: false, isListed: true }).sort({ name: 1 }).lean();
            res.locals.navbarCategories = categories;
        } catch (err) {
            console.error('Error fetching categories for navbar:', err);
        }

        if (req.session && (req.session.user || req.session.user_id)) {
            try {
                const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
                if (userId) {
                    const cart = await Cart.findOne({ userId });
                    if (cart && cart.items) {
                        res.locals.cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
                    }
                    const wishlist = await wishlistService.cleanUnavailableWishlistItems(userId);
                    if (wishlist && wishlist.products) {
                        res.locals.wishlistCount = wishlist.products.length;
                        res.locals.wishlistProductIds = wishlist.products.map(p => p._id.toString());
                    }
                }
            } catch (err) {
                console.error('Error fetching cart/wishlist count for locals:', err);
            }
        }
        next();
    },
    userRoutes
);


// 404
app.use((req, res, next) => {
    res.status(404).render('user/404');
});


app.listen(5000, () => {
    console.log('Server Running On Port 5000');
});