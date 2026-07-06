

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/furnitureDB';

async function fixWalletBalances() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const User = (await import('../models/user.js')).default;
        const WalletTransaction = (await import('../models/walletTransaction.js')).default;

        // Find all users who have wallet balance > 0
        const usersWithBalance = await User.find({ wallet: { $gt: 0 } });
        console.log(`Found ${usersWithBalance.length} users with wallet balance > 0`);

        let fixed = 0;
        for (const user of usersWithBalance) {
            const txCount = await WalletTransaction.countDocuments({ userId: user._id });
            
            if (txCount === 0) {
               
                console.log(`Resetting wallet for user ${user.email} (${user._id}): ₹${user.wallet} → ₹0 (no transactions found)`);
                user.wallet = 0;
                await user.save();
                fixed++;
            } else {
                const transactions = await WalletTransaction.find({ userId: user._id });
                let calculatedBalance = 0;
                for (const tx of transactions) {
                    if (tx.type === 'credit') {
                        calculatedBalance += tx.amount;
                    } else if (tx.type === 'debit') {
                        calculatedBalance -= tx.amount;
                    }
                }
                calculatedBalance = Math.max(0, calculatedBalance);
                
                if (Math.abs(user.wallet - calculatedBalance) > 0.01) {
                    console.log(`Correcting wallet for user ${user.email} (${user._id}): ₹${user.wallet} → ₹${calculatedBalance} (based on ${txCount} transactions)`);
                    user.wallet = calculatedBalance;
                    await user.save();
                    fixed++;
                } else {
                    console.log(`User ${user.email} wallet ₹${user.wallet} matches transactions — no change needed`);
                }
            }
        }

        console.log(`\nDone. Fixed ${fixed} out of ${usersWithBalance.length} users.`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixWalletBalances();
