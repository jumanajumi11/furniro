import express from 'express';
import * as referralController from '../../controllers/admin/referral.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/referrals', auth.isAdmin, referralController.getReferralSystem);
router.post('/referrals/settings', auth.isAdmin, referralController.updateReferralSettings);

export default router;
