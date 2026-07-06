import User from '../../models/user.js';
import WalletTransaction from '../../models/walletTransaction.js';

export const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to view wallet');
        }

        const user = await User.findById(userId);
        
        const ITEMS_PER_PAGE = 10;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const filter = req.query.filter || 'all'; 
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const query = { userId };
        if (filter === 'credit') query.type = 'credit';
        if (filter === 'debit') query.type = 'debit';

        const [transactions, totalTransactions] = await Promise.all([
            WalletTransaction.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(ITEMS_PER_PAGE)
                .lean(),
            WalletTransaction.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalTransactions / ITEMS_PER_PAGE);

        res.render('user/wallet', {
            user,
            transactions,
            page: 'wallet',
            currentPage: page,
            totalPages,
            totalTransactions,
            filter
        });
    } catch (error) {
        console.error('Load Wallet Page Error:', error.message);
        res.redirect('/profile?error=Could not load wallet');
    }
};

