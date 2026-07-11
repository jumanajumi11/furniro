import Order from '../../models/order.js';
import User from '../../models/user.js';
import Product from '../../models/product.js';
import Cart from '../../models/cart.js';
import crypto from 'crypto';
import razorpayInstance from '../../config/razorpay.js';

export const loadSuccess = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) {
            return res.redirect('/shop?error=Order not found');
        }

        const estDelivery = new Date(order.createdAt);
        estDelivery.setDate(estDelivery.getDate() + 5);

        res.render('user/order-success', {
            order,
            estimatedDeliveryDate: estDelivery.toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })
        });
    } catch (error) {
        console.error('Load Success Page Error:', error.message);
        res.redirect('/shop?error=Something went wrong');
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key';
        console.log("--- RAZORPAY VERIFY PAYMENT DEBUG ---");
        console.log("orderId:", orderId);
        console.log("razorpayPaymentId:", razorpayPaymentId);
        console.log("razorpayOrderId:", razorpayOrderId);
        console.log("razorpaySignature:", razorpaySignature);
        console.log("secret length:", secret ? secret.length : 0);

        const generatedSignature = crypto.createHmac('sha256', secret)
            .update(razorpayOrderId + "|" + razorpayPaymentId)
            .digest('hex');
            
        console.log("generatedSignature:", generatedSignature);
        console.log("match:", generatedSignature === razorpaySignature);
        console.log("-------------------------------------");

        if (generatedSignature === razorpaySignature) {
            order.paymentStatus = 'Paid';
            order.status = 'Pending';
            order.razorpayPaymentId = razorpayPaymentId;
            order.razorpaySignature = razorpaySignature;
            await order.save();

            // Deduct from wallet if partial wallet payment was used
            if (order.walletDeduction > 0) {
                const user = await User.findById(order.userId);
                if (user) {
                    user.wallet = Math.max(0, (user.wallet || 0) - order.walletDeduction);
                    await user.save();

                    await WalletTransaction.create({
                        userId: order.userId,
                        amount: order.walletDeduction,
                        type: 'debit',
                        description: `Payment for Order #${order.orderNumber} (Wallet Deduction)`,
                        orderId: order._id,
                        status: 'completed',
                        transactionDate: new Date()
                    });
                }
            }

            for (const item of order.items) {
                const product = await Product.findById(item.productId);
                if (product) {
                    if (product.variants && product.variants.length > 0 && item.variantId) {
                        const variant = product.variants.id(item.variantId);
                        if (variant) {
                            variant.stock = Math.max(0, variant.stock - item.quantity);
                        }
                    } else {
                        product.stock = Math.max(0, product.stock - item.quantity);
                    }
                    await product.save();
                }
            }

            const userId = order.userId;
            await Cart.updateOne({ userId }, { $set: { items: [] } });

            return res.status(200).json({ success: true, message: 'Payment verified successfully', orderId: order._id });
        } else {
            order.paymentStatus = 'Failed';
            order.status = 'Payment Failed';
            await order.save();
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

    } catch (error) {
        console.error('Verify Payment Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId).populate('userId');
        if (!order || !['Pending Payment', 'Payment Failed'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Invalid order or order is not pending payment' });
        }

        const options = {
            amount: Math.round((order.payableAmount !== undefined ? order.payableAmount : order.grandTotal) * 100),
            currency: "INR",
            receipt: "" + order.orderNumber
        };
        
        const rzpOrder = await razorpayInstance.orders.create(options);
        order.razorpayOrderId = rzpOrder.id;
        await order.save();

        const user = await User.findById(order.userId);

        const razorpayOrderDetails = {
            key: process.env.RAZORPAY_KEY_ID || 'rzp_test_521479843260-8fbrcfhrf7ic3n1rnp1582qqkjlnp057',
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            id: rzpOrder.id,
            name: "Furniture E-Commerce",
            description: "Order Payment Retry",
            prefill: {
                name: order.shippingAddress.name,
                contact: order.shippingAddress.phone,
                email: user ? user.email : ""
            }
        };

        return res.json({ success: true, razorpayOrder: razorpayOrderDetails });

    } catch (error) {
        console.error('Retry Payment Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to initialize payment gateway' });
    }
};

export const loadFailure = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.redirect('/shop?error=Order not found');
        }

        if (order.paymentStatus !== 'Paid') {
            order.status = 'Payment Failed';
            order.paymentStatus = 'Failed';
            await order.save();
        }

        res.render('user/order-failure', {
            order
        });
    } catch (error) {
        console.error('Load Failure Page Error:', error.message);
        res.redirect('/shop?error=Something went wrong');
    }
};
