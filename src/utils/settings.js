import Settings from '../models/settings.js';

export const getSettings = async () => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({
                referralEnabled: true,
                referrerReward: 200,
                referredReward: 100
            });
        }
        return settings;
    } catch (err) {
        console.error('Error fetching settings:', err);
        return {
            referralEnabled: true,
            referrerReward: 200,
            referredReward: 100
        };
    }
};
