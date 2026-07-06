import express from 'express';
import * as walletController from '../../controllers/user/wallet.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/wallet', auth.isLogin, walletController.loadWallet);

export default router;
