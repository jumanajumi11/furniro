import express from 'express';
import * as securityController from '../../controllers/user/security.controller.js';
import * as auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/security',
    auth.isLogin,
    securityController.loadSecurity
);

router.post('/change-password',
    auth.isLogin,
    securityController.changePassword
);

router.post('/create-password',
    auth.isLogin,
    securityController.createPassword
);

export default router;