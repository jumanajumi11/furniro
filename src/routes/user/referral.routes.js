import express from 'express';
import * as referralController from '../../controllers/user/referral.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/referrals', auth.isLogin, referralController.loadUserReferrals);

export default router;
