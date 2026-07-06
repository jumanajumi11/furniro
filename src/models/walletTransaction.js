import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed'],
        default: 'completed'
    },
    transactionDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, orderId: 1, type: 1, description: 1 });

export default mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema);
