import addressService from '../../services/user/address.service.js';
import profileService from '../../services/user/profile.service.js';

export const loadAddresses = async (req, res, next) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        if (userId) {
            const userData = await profileService.getUserById(userId);
            return res.render('user/addresses', { user: userData });
        }
        res.render('user/addresses', { user: null });
    } catch (error) {
        console.log("Error in loadAddresses:", error.message);
        res.status(500).send("Server Error");
    }
};

export const addAddress = async (req, res, next) => {
    try {
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        await addressService.addAddress(userId, req.body);
        res.json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.log("Add Address Error:", error.message);
        res.status(500).json({ success: false, message: error.message || 'Failed to add address' });
    }
};

export const editAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        await addressService.editAddress(userId, addressId, req.body);
        res.json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
        console.log("Edit Address Error:", error.message);
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
        console.log(error.message);
        res.redirect('/addresses');
    }
};

export const deleteAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user ? req.session.user._id : null;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        await addressService.deleteAddress(userId, addressId);
        res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: error.message || 'Failed to delete address' });
    }
};

export default {
    loadAddresses,
    addAddress,
    editAddress,
    loadEditAddress,
    deleteAddress
};
