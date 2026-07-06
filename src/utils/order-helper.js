

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
