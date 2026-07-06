import Settings from '../../models/settings.js';
import ReferralHistory from '../../models/referralHistory.js';

export const getReferralSystem = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({
                referralEnabled: true,
                referrerReward: 200,
                referredReward: 100
            });
            await settings.save();
        }

        const referralHistory = await ReferralHistory.find()
            .populate('referrer', 'name email')
            .populate('referred', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.render('admin/referrals', {
            settings,
            referralHistory,
            activePage: 'referrals'
        });
    } catch (error) {
        console.error('[Admin Referral] getReferralSystem Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const updateReferralSettings = async (req, res) => {
    try {
        const { referralEnabled, referrerReward, referredReward } = req.body;

        const referrerAmt = parseFloat(referrerReward);
        const referredAmt = parseFloat(referredReward);

        if (isNaN(referrerAmt) || referrerAmt < 0 || isNaN(referredAmt) || referredAmt < 0) {
            return res.status(400).json({ success: false, message: 'Reward amounts must be positive numbers.' });
        }

        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }

        settings.referralEnabled = referralEnabled === 'true' || referralEnabled === true;
        settings.referrerReward = referrerAmt;
        settings.referredReward = referredAmt;
        await settings.save();

        return res.status(200).json({ success: true, message: 'Referral settings updated successfully!' });
    } catch (error) {
        console.error('[Admin Referral] updateReferralSettings Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
