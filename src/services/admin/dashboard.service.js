export const loadDashboard = async (req, res) => {
    try {
        const Order = (await import('../../models/order.js')).default;
        const Product = (await import('../../models/product.js')).default;
        const User = (await import('../../models/user.js')).default;

       
        const totalOrders = await Order.countDocuments();
        const totalUsers = await User.countDocuments({ isAdmin: false });
        const totalProducts = await Product.countDocuments({ isDeleted: false });

        const revenueAggregation = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Payment Failed', 'Pending Payment'] } } },
            { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' } } }
        ]);
        const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

        const topProducts = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Payment Failed', 'Pending Payment'] } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    quantitySold: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { quantitySold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }
        ]);

        
        const topCategories = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Payment Failed', 'Pending Payment'] } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$product.category',
                    quantitySold: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { quantitySold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
        ]);

       
        const topBrands = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Payment Failed', 'Pending Payment'] } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ['$product.brand', 'Furniro'] },
                    quantitySold: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { quantitySold: -1 } },
            { $limit: 10 }
        ]);

        const recentOrders = await Order.find()
            .populate('userId', 'name email image')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        const [total, pending, shipped, delivered, cancelled] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ status: { $in: ['Pending', 'Pending Payment'] } }),
            Order.countDocuments({ status: 'Shipped' }),
            Order.countDocuments({ status: 'Delivered' }),
            Order.countDocuments({ status: 'Cancelled' }),
        ]);
        const statusCounts = { total, pending, shipped, delivered, cancelled };

        res.render('admin/dashboard', {
            totalOrders,
            totalUsers,
            totalProducts,
            totalRevenue,
            topProducts,
            topCategories,
            topBrands,
            recentOrders,
            statusCounts,
            activePage: 'dashboard'
        });
    } catch (error) {
        console.error("Load Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};

export const getDashboardChartData = async (req, res) => {
    try {
        const filter = req.query.filter || 'Monthly';
        const now = new Date();
        let startDate = new Date();
        let groupExpr = {};
        let labelFormat = null;

        const Order = (await import('../../models/order.js')).default;

        switch (filter) {
            case 'Daily':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                groupExpr = { $hour: '$createdAt' };
                labelFormat = (id) => `${id}:00`;
                break;
            case 'Weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                groupExpr = { $dayOfWeek: '$createdAt' };
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                labelFormat = (id) => days[id - 1] || id;
                break;
            case 'Monthly':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                groupExpr = { $dateToString: { format: '%b %d', date: '$createdAt' } };
                labelFormat = (id) => id;
                break;
            case 'Yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                groupExpr = { $month: '$createdAt' };
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                labelFormat = (id) => months[id - 1] || id;
                break;
        }

        const chartStats = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $nin: ['Cancelled', 'Payment Failed', 'Pending Payment'] }
                }
            },
            {
                $group: {
                    _id: groupExpr,
                    orderCount: { $sum: 1 },
                    revenue: { $sum: '$grandTotal' },
                    salesCount: { $sum: { $sum: '$items.quantity' } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const labels = chartStats.map(item => labelFormat(item._id));
        const salesTrend = chartStats.map(item => item.salesCount);
        const revenueTrend = chartStats.map(item => item.revenue);
        const orderTrend = chartStats.map(item => item.orderCount);

        return res.status(200).json({
            success: true,
            labels,
            salesTrend,
            revenueTrend,
            orderTrend
        });
    } catch (error) {
        console.error('[Admin Dashboard Stats] Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
