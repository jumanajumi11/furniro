import express from 'express';
import * as homeController from '../../controllers/user/home.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', auth.isLogin, homeController.loadHome);

router.get('/home', auth.isLogin, (req, res) => {
    res.redirect('/');
});

export default router;