import addressService from '../../services/user/address.service.js';
import profileService from '../../services/user/profile.service.js';
import { logger } from '../../utils/logger.js';
import { addressSchema } from '../../validators/address.validator.js';
import User from '../../models/user.js';

export const loadAddresses = async (req, res, next) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        if (userId) {
            const userData = await profileService.getUserById(userId);
            return res.render('user/addresses', { user: userData });
        }
        res.render('user/addresses', { user: null });
    } catch (error) {
        logger.error('Error in loadAddresses:', error.message);
        res.status(500).send("Server Error");
    }
};

export const addAddress = async (req, res, next) => {
    try {
        console.log('[Add Address Route Hit]');
        console.log('Request Body (req.body):', req.body);
        console.log('Session User:', req.session.user ? req.session.user._id : 'NOT SET');

        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        await addressService.addAddress(userId, req.body);
        res.json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.error('Add Address Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to add address' });
    }
};

export const editAddress = async (req, res, next) => {
    try {
        // Debug logs
        console.log('[Edit Address Route Hit]');
        console.log('Address ID (req.params.id):', req.params.id);
        console.log('Request Body (req.body):', req.body);
        console.log('Session User (req.session.user):', req.session.user ? req.session.user._id : 'NOT SET');

        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        await addressService.editAddress(userId, addressId, req.body);
        res.json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
        console.error('Update Address Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update address' });
    }
};

export const loadEditAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.redirect('/login');

        const address = await addressService.getUserAddress(userId, addressId);
        res.render('user/edit-address', { address: address });
    } catch (error) {
        logger.error('deleteAddress error:', error.message);
        res.redirect('/addresses');
    }
};

export const deleteAddress = async (req, res, next) => {
    try {
        console.log('[Delete Address Route Hit]');
        console.log('Address ID (req.params.id):', req.params.id);
        console.log('Session User:', req.session.user ? req.session.user._id : 'NOT SET');

        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        await addressService.deleteAddress(userId, addressId);
        res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.error('Delete Address Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to delete address' });
    }
};

export const addCheckoutAddress = async (req, res) => {
    try {
        const { error } = addressSchema.validate(req.body, { abortEarly: false, allowUnknown: true });

        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                const key = detail.path[0];
                errors[key] = detail.message;
            });
            return res.status(400).json({
                success: false,
                errors,
                message: 'Validation failed'
            });
        }

        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to add address' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newAddress = {
            name: req.body.name.trim(),
            phone: req.body.phone.trim(),
            pincode: req.body.pincode.trim(),
            locality: req.body.locality.trim(),
            city: req.body.city,
            state: req.body.state,
            area: req.body.area.trim(),
            house: req.body.house.trim(),
            isDefault: req.body.isDefault === true || req.body.isDefault === 'true'
        };

        if (newAddress.isDefault) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }

        user.addresses.push(newAddress);
        await user.save();

        const savedAddress = user.addresses[user.addresses.length - 1];

        return res.status(200).json({
            success: true,
            message: 'Address added successfully',
            addresses: user.addresses,
            newAddressId: savedAddress._id
        });

    } catch (error) {
        console.error('Add Address Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export default {
    loadAddresses,
    addAddress,
    editAddress,
    loadEditAddress,
    deleteAddress,
    addCheckoutAddress
};

