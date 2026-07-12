

/**
 * Automatically calculates and returns the overall order status based on item statuses.
 * @param {object} order - Mongoose Order document
 * @returns {string} - The derived status
 */
export const calculateOrderStatus = (order) => {
    if (order.status === 'Pending Payment' || order.status === 'Payment Failed') {
        if (order.items && order.items.every(item => item.status === 'Cancelled')) {
            return 'Cancelled';
        }
        return order.status;
    }

    const items = order.items || [];
    if (items.length === 0) return 'Pending';

    const statuses = items.map(item => item.status || 'Pending');

    const cancelledCount      = statuses.filter(s => s === 'Cancelled').length;
    const returnedCount       = statuses.filter(s => s === 'Returned').length;
    const deliveredCount      = statuses.filter(s => s === 'Delivered').length;
    const returnRequestedCount = statuses.filter(s => s === 'Return Requested').length;
    const totalItems          = statuses.length;

    const terminalStatuses = ['Cancelled', 'Returned', 'Return Rejected'];

    const activeStatuses = statuses.filter(s => !terminalStatuses.includes(s));

    if (returnedCount === totalItems) {
        return 'Returned';
    }

    if (cancelledCount === totalItems) {
        return 'Cancelled';
    }

    if (deliveredCount === totalItems) {
        return 'Delivered';
    }

    const uniqueStatuses = [...new Set(statuses)];
    if (uniqueStatuses.length === 1) {
        return uniqueStatuses[0];
    }

    if (returnRequestedCount > 0) {
        return 'Return Requested';
    }

    if (returnedCount > 0) {
        return 'Partially Returned';
    }

    if (deliveredCount > 0 && activeStatuses.every(s => s === 'Delivered')) {
        return 'Partially Delivered';
    }

    if (cancelledCount > 0 && activeStatuses.length > 0) {
        return 'Partially Cancelled';
    }

    if (activeStatuses.length === 0) {
        return 'Cancelled';
    }

    const priorityOrder = [
        'Out For Delivery',
        'Shipped',
        'Processing',
        'Pending'
    ];

    for (const ps of priorityOrder) {
        if (activeStatuses.includes(ps)) {
            return ps;
        }
    }

    return activeStatuses[0] || 'Pending';
};

/**
 * Calculates the proportional refund amount for a specific order item.
 * @param {object} order - Mongoose Order document
 * @param {object} item - The order item being cancelled or returned
 * @returns {number} - The proportional refund amount (rounded)
 */
export const calculateItemRefund = (order, item) => {
    const itemTotal = item.price * item.quantity;
    
    const orderSubtotal = order.subtotal || order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const itemContributionRatio = orderSubtotal > 0 ? (itemTotal / orderSubtotal) : 0;

    const couponDiscountShare = Math.round((order.couponDiscount || 0) * itemContributionRatio);
    const taxShare = Math.round((order.tax || 0) * itemContributionRatio);

    let refundAmount = Math.max(0, itemTotal - couponDiscountShare + taxShare);

    const activeItems = order.items.filter(i => 
        i._id.toString() !== item._id.toString() && 
        i.status !== 'Cancelled' && 
        i.status !== 'Returned'
    );
    
    if (activeItems.length === 0) {
        const totalAlreadyRefunded = order.refundedAmount || 0;
        refundAmount = Math.max(0, order.grandTotal - totalAlreadyRefunded);
    }
    
    return refundAmount;
};

export const processPendingRefunds = async (order) => {
    const isOnlinePayment = ['Wallet', 'Razorpay'].includes(order.paymentMethod);
    const isCODPaid = order.paymentMethod === 'COD' && order.paymentStatus === 'Paid';
    const shouldRefund = (isOnlinePayment && order.paymentStatus === 'Paid') || isCODPaid;
    const isAlreadyRefunded = order.paymentStatus === 'Refunded';

    if (!shouldRefund && !isAlreadyRefunded) return;

    // Dynamically import models to prevent circular dependency / initialization issues
    const User = (await import('../models/user.js')).default;
    const Product = (await import('../models/product.js')).default;
    const WalletTransaction = (await import('../models/walletTransaction.js')).default;

    let orderModified = false;
    for (const item of order.items) {
        if (item.status === 'Returned' || item.returnStatus === 'Approved') {
            if (!item.refundAmount || item.refundAmount === 0) {
                const refundAmount = calculateItemRefund(order, item);
                if (shouldRefund && refundAmount > 0) {
                    const product = await Product.findById(item.productId);
                    const prodName = product ? product.productName : 'Item';
                    
                    const escapedProdName = prodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const existingRefund = await WalletTransaction.findOne({
                        userId: order.userId,
                        orderId: order._id,
                        type: 'credit',
                        description: { $regex: new RegExp(`Refund for Returned Item:.*${escapedProdName}.*#${order.orderNumber}`) }
                    });

                    if (!existingRefund) {
                        const user = await User.findById(order.userId);
                        if (user) {
                            user.wallet = (user.wallet || 0) + refundAmount;
                            await user.save();

                            order.refundedAmount = (order.refundedAmount || 0) + refundAmount;
                            order.refundDate = new Date();

                            const refundDescription = `Refund for Returned Item: ${prodName} (#${order.orderNumber})`;
                            await WalletTransaction.create({
                                userId: order.userId,
                                amount: refundAmount,
                                type: 'credit',
                                description: refundDescription,
                                orderId: order._id,
                                status: 'completed',
                                transactionDate: new Date()
                            });
                        }
                    }
                    item.refundAmount = refundAmount;
                    orderModified = true;
                } else if (isAlreadyRefunded) {
                    item.refundAmount = refundAmount;
                    orderModified = true;
                }
            }
        }
    }
    if (orderModified) {
        order.markModified('items');
    }
};
