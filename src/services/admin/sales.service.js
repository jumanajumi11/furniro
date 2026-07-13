import Order from '../../models/order.js';
import WalletTransaction from '../../models/walletTransaction.js';
import { logger } from '../../utils/logger.js';

// --- Ledger Book Calculations ---
export const getLedgerEntries = async () => {
    const entries = [];

    logger.debug('[LedgerService] Fetching orders and wallet transactions...');
    const orders = await Order.find({
        status: { $nin: ['Cancelled', 'Payment Failed', 'Pending Payment'] }
    }).lean();

    orders.forEach(order => {
        const grossAmount = order.grandTotal + (order.couponDiscount || 0);

        entries.push({
            date: new Date(order.createdAt),
            type: 'Credit',
            category: 'Sale',
            description: `Sale from Order #${order.orderNumber || order._id}`,
            amount: grossAmount,
            refId: order._id
        });

        if (order.couponDiscount > 0) {
            entries.push({
                date: new Date(order.createdAt),
                type: 'Debit',
                category: 'Coupon Discount',
                description: `Coupon deduction for Order #${order.orderNumber || order._id}`,
                amount: order.couponDiscount,
                refId: order._id
            });
        }
    });

    const walletTxs = await WalletTransaction.find().lean();

    walletTxs.forEach(tx => {
        const desc = tx.description || '';

        if (desc.includes('Refund')) {
            entries.push({
                date: new Date(tx.transactionDate || tx.createdAt),
                type: 'Debit',
                category: 'Refund',
                description: `Refund: ${desc}`,
                amount: tx.amount,
                refId: tx.orderId || tx._id
            });
        } else if (desc.includes('Referral')) {
            entries.push({
                date: new Date(tx.transactionDate || tx.createdAt),
                type: 'Debit',
                category: 'Referral Reward',
                description: `Referral payout: ${desc}`,
                amount: tx.amount,
                refId: tx._id
            });
        } else {
            if (tx.type === 'credit') {
                entries.push({
                    date: new Date(tx.transactionDate || tx.createdAt),
                    type: 'Debit',
                    category: 'Wallet Adjustment',
                    description: `Wallet credit payout: ${desc}`,
                    amount: tx.amount,
                    refId: tx._id
                });
            } else {
                if (!tx.orderId) {
                    entries.push({
                        date: new Date(tx.transactionDate || tx.createdAt),
                        type: 'Credit',
                        category: 'Wallet adjustment',
                        description: `Wallet debit adjustment: ${desc}`,
                        amount: tx.amount,
                        refId: tx._id
                    });
                }
            }
        }
    });

    logger.debug('[LedgerService] getLedgerEntries — orders processed:', orders.length, '| wallet txs processed:', walletTxs.length, '| total entries:', entries.length);
    return entries;
};

export const computeDateRange = (filter, customStart, customEnd) => {
    const kolkataNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    let startKolkata = new Date(kolkataNow);
    let endKolkata = new Date(kolkataNow);

    switch (filter) {
        case 'Daily':
            startKolkata.setHours(0, 0, 0, 0);
            endKolkata.setHours(23, 59, 59, 999);
            break;
        case 'Weekly':
            startKolkata.setDate(kolkataNow.getDate() - 6); // 7 days including today
            startKolkata.setHours(0, 0, 0, 0);
            endKolkata.setHours(23, 59, 59, 999);
            break;
        case 'Monthly':
            startKolkata.setDate(1);
            startKolkata.setHours(0, 0, 0, 0);
            endKolkata.setHours(23, 59, 59, 999);
            break;
        case 'Yearly':
            startKolkata.setMonth(0, 1);
            startKolkata.setHours(0, 0, 0, 0);
            endKolkata.setHours(23, 59, 59, 999);
            break;
        case 'Custom':
            if (customStart) {
                const [y, m, d] = customStart.split('-').map(Number);
                startKolkata = new Date(y, m - 1, d, 0, 0, 0, 0);
            } else {
                startKolkata.setDate(kolkataNow.getDate() - 30);
                startKolkata.setHours(0, 0, 0, 0);
            }
            if (customEnd) {
                const [y, m, d] = customEnd.split('-').map(Number);
                endKolkata = new Date(y, m - 1, d, 23, 59, 59, 999);
            } else {
                endKolkata.setHours(23, 59, 59, 999);
            }
            break;
        default:
            startKolkata.setDate(kolkataNow.getDate() - 30);
            startKolkata.setHours(0, 0, 0, 0);
            endKolkata.setHours(23, 59, 59, 999);
    }

    const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
    const startDate = new Date(startKolkata.getTime() - kolkataOffsetMs);
    const endDate = new Date(endKolkata.getTime() - kolkataOffsetMs);

    return { startDate, endDate };
};

export const computeLedgerData = async (filter, customStart, customEnd) => {
    const { startDate, endDate } = computeDateRange(filter, customStart, customEnd);

    const allEntries = await getLedgerEntries();

    let openingBalance = 0;
    allEntries.forEach(entry => {
        if (entry.date < startDate) {
            openingBalance += entry.type === 'Credit' ? entry.amount : -entry.amount;
        }
    });

    const rangeEntries = allEntries
        .filter(entry => entry.date >= startDate && entry.date <= endDate)
        .sort((a, b) => a.date - b.date);

    let running = openingBalance;
    let totalCredits = 0;
    let totalDebits = 0;

    const detailedTable = rangeEntries.map(entry => {
        if (entry.type === 'Credit') {
            running += entry.amount;
            totalCredits += entry.amount;
        } else {
            running -= entry.amount;
            totalDebits += entry.amount;
        }
        return { ...entry, runningBalance: running };
    });

    const closingBalance = running;

    return {
        openingBalance,
        totalCredits,
        totalDebits,
        closingBalance,
        detailedTable,
        startDate,
        endDate
    };
};

// --- Sales Report Calculations ---
export const getDateRange = computeDateRange;

export const compileReportData = async (startDate, endDate) => {
    const orders = await Order.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $nin: ['Cancelled', 'Payment Failed', 'Pending Payment'] }
    })
    .populate('userId', 'name email phone image')
    .populate({
        path: 'items.productId',
        select: 'productName regularPrice variants'
    })
    .sort({ createdAt: -1 })
    .lean();

    let totalOrders = orders.length;
    let totalSalesCount = 0;
    let netRevenue = 0;
    let couponDiscount = 0;
    let offerDiscount = 0;

    const detailedTable = orders.map(order => {
        let orderOfferDiscount = 0;
        
        order.items.forEach(item => {
            totalSalesCount += item.quantity;
            const prod = item.productId;
            if (prod) {
                let originalPrice = prod.regularPrice;
                if (prod.variants && prod.variants.length > 0 && item.variantId) {
                    const variant = prod.variants.find(v => v._id.toString() === item.variantId.toString());
                    if (variant) {
                        originalPrice = variant.price;
                    }
                }
                if (originalPrice > item.price) {
                    orderOfferDiscount += (originalPrice - item.price) * item.quantity;
                }
            }
        });

        netRevenue += order.grandTotal;
        couponDiscount += order.couponDiscount || 0;
        offerDiscount += orderOfferDiscount;

        const grossOrderAmount = order.grandTotal + (order.couponDiscount || 0) + orderOfferDiscount;

        return {
            orderId: order.orderNumber || order._id,
            date: order.createdAt,
            customer: order.userId ? order.userId.name : (order.shippingAddress ? order.shippingAddress.name : 'Guest User'),
            paymentMethod: order.paymentMethod,
            orderAmount: grossOrderAmount,
            couponDeduction: order.couponDiscount || 0,
            offerDeduction: orderOfferDiscount,
            finalAmount: order.grandTotal
        };
    });

    const totalDiscount = couponDiscount + offerDiscount;
    const grossRevenue = netRevenue + totalDiscount;

    return {
        summary: {
            totalOrders,
            totalSalesCount,
            grossRevenue,
            couponDiscount,
            offerDiscount,
            totalDiscount,
            netRevenue
        },
        detailedTable
    };
};
