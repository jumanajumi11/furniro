import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
const connectDB = async () => {
  try {
    const connectionUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGODB;
    await mongoose.connect(connectionUri, {
      dbName: 'furnitureDB'
    });
    logger.info(`MongoDB Connected to database: ${mongoose.connection.db.databaseName} ✅`);

    
    try {
      const User = (await import('../models/user.js')).default;
      const WalletTransaction = (await import('../models/walletTransaction.js')).default;

      const usersWithBalance = await User.find({ wallet: { $gt: 0 } });

      for (const user of usersWithBalance) {
        const txCount = await WalletTransaction.countDocuments({ userId: user._id });

        if (txCount === 0) {
          user.wallet = 0;
          await user.save();
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
            user.wallet = calculatedBalance;
            await user.save();
          }
        }
      }
    } catch (migError) {
      logger.error('[Migration] Wallet balance reconciliation failed:', migError);
    }

  } catch (error) {
    logger.error('DB Error:', error);
    process.exit(1);
  }
};

export default connectDB;