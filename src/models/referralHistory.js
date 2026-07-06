import mongoose from 'mongoose';

const referralHistorySchema = new mongoose.Schema({
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referred: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true 
    },
    referrerReward: {
        type: Number,
        required: true
    },
    referredReward: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        default: 'Completed'
    }
}, { timestamps: true });

const ReferralHistory = mongoose.models.ReferralHistory || mongoose.model('ReferralHistory', referralHistorySchema);
export default ReferralHistory;
