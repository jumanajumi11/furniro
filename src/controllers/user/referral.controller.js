import User from '../../models/user.js';

export const loadUserReferrals = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        if (!user.referralCode) {
            user.referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
            await user.save();
        }

        const { getSettings } = await import('../../utils/settings.js');
        const settings = await getSettings();

        const ReferralHistory = (await import('../../models/referralHistory.js')).default;
        const history = await ReferralHistory.find({ referrer: userId })
            .populate('referred', 'name email createdAt')
            .sort({ createdAt: -1 })
            .lean();

        res.render('user/referrals', {
            user,
            referralCode: user.referralCode,
            settings,
            history
        });
    } catch (error) {
        console.error('Load User Referrals Page Error:', error.message);
        res.redirect('/profile?error=Could not load referrals');
    }
};
