import express from 'express';
import passport from 'passport';
import * as googleAuthController from '../../controllers/user/googleAuth.controller.js';

const router = express.Router();

router.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

router.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login'
    }),
    googleAuthController.googleCallback
);

export default router;