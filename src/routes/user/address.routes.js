import express from 'express';
import * as addressController from '../../controllers/user/address.controller.js';
import * as auth from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validation.js';
import { addressSchema } from '../../validators/address.validator.js';

const router = express.Router();

router.get('/addresses', auth.isLogin, addressController.loadAddresses);
router.post('/addresses', auth.isLogin, validate(addressSchema), addressController.addAddress);
router.put('/addresses/:id', auth.isLogin, validate(addressSchema), addressController.editAddress);
router.delete('/addresses/:id', auth.isLogin, addressController.deleteAddress);

export default router;
