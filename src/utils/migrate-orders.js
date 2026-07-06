import Order from '../models/order.js';
import { logger } from './logger.js';

export const migrateOrders = async () => {
    try {
        const orders = await Order.find({
            $or: [
                { 'items.status': { $exists: false } },
                { 'items.status': 'Placed' }
            ]
        });

        if (orders.length === 0) {
            return;
        }

        for (const order of orders) {
            let updated = false;
            for (const item of order.items) {
                if (!item.status || item.status === 'Placed') {
                    if (order.status === 'Pending Payment' || order.status === 'Payment Failed') {
                        item.status = 'Pending';
                    } else if (order.status === 'Cancelled') {
                        item.status = 'Cancelled';
                        item.cancelledAt = item.cancelledAt || order.updatedAt || new Date();
                    } else if (order.status === 'Returned') {
                        item.status = 'Returned';
                        item.returnedAt = item.returnedAt || order.updatedAt || new Date();
                    } else if (order.status === 'Return Requested') {
                        item.status = 'Return Requested';
                    } else if (order.status === 'Return Rejected') {
                        item.status = 'Return Rejected';
                    } else {
                        item.status = order.status || 'Pending';
                    }

                    if (item.status === 'Delivered') {
                        item.deliveredAt = item.deliveredAt || order.updatedAt || new Date();
                    }
                    updated = true;
                }
            }

            if (updated) {
                await order.save({ validateBeforeSave: false });
            }
        }

    } catch (error) {
        logger.error('[Migration] Order status migration failed:', error);
    }
};
