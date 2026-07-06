import User from '../../models/user.js';
import Coupon from '../../models/coupon.js';

export const loadCoupons = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        const user = userId ? await User.findById(userId) : null;
        const coupons = await Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } });

        res.render('user/coupons', {
            user,
            coupons,
            page: 'coupons'
        });
    } catch (error) {
        console.error('Load Coupons Page Error:', error.message);
        res.redirect('/profile?error=Could not load coupons');
    }
};
