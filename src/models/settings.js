import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    referralEnabled: {
        type: Boolean,
        default: true
    },
    referrerReward: {
        type: Number,
        default: 200,
        min: 0
    },
    referredReward: {
        type: Number,
        default: 100,
        min: 0
    }
}, { timestamps: true });

const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export default Settings;
