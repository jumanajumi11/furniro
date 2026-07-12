import mongoose from 'mongoose';
import Order from '../src/models/order.js';

async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/furnitureDB');
    console.log('Connected to DB');

    const orders = await Order.find({}).sort({ createdAt: -1 }).limit(10).lean();
    console.log(`Found ${orders.length} orders:`);
    for (const order of orders) {
        console.log(`Order #${order.orderNumber} (ID: ${order._id}):`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Payment Method: ${order.paymentMethod}`);
        console.log(`  Payment Status: ${order.paymentStatus}`);
        console.log(`  Refunded Amount: ${order.refundedAmount}`);
        console.log(`  Items:`);
        for (const item of order.items) {
            console.log(`    - Product: ${item.productId}`);
            console.log(`      Status: ${item.status}`);
            console.log(`      Return Status: ${item.returnStatus}`);
            console.log(`      Refund Amount: ${item.refundAmount}`);
            console.log(`      Refund Status: ${item.refundStatus}`);
        }
        console.log('---------------------------------------------');
    }

    await mongoose.disconnect();
}
run().catch(console.error);
