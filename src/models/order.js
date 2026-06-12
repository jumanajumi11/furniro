import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId }, // Variant ID is optional for products without variants
    quantity:  { type: Number, required: true },
    price:     { type: Number, required: true },
    status: {
        type: String,
        default: 'Placed',
        enum: ['Placed', 'Processing', 'Shipped', 'Out For Delivery', 'Delivered', 'Cancelled', 'Returned', 'Return Requested', 'Return Rejected']
    },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    refundAmount: { type: Number }
});

const orderSchema = new mongoose.Schema({
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber:  { type: String, required: true, unique: true },
    items:        [orderItemSchema],
    shippingAddress: {
        name:     { type: String, required: true },
        phone:    { type: String, required: true },
        house:    { type: String, required: true },
        locality: { type: String, required: true },
        area:     { type: String, required: true },
        city:     { type: String, required: true },
        state:    { type: String, required: true },
        pincode:  { type: String, required: true }
    },
    paymentMethod: { type: String, required: true }, // 'COD' | 'Razorpay' | 'Wallet'
    paymentStatus: { type: String, default: 'Pending', enum: ['Pending', 'Paid', 'Failed', 'Refunded'] },
    subtotal:      { type: Number, required: true },
    tax:           { type: Number, required: true },
    shippingCharge:{ type: Number, required: true },
    discount:      { type: Number, default: 0 },
    couponDiscount:{ type: Number, default: 0 },
    grandTotal:    { type: Number, required: true },
    couponCode:    { type: String },
    notes:         { type: String },
    cancellationReason: { type: String },
    returnReason:       { type: String },
    status: {
        type: String,
        default: 'Pending Payment',
        enum: [
            'Pending Payment',
            'Payment Failed',
            'Processing',
            'Shipped',
            'Out For Delivery',
            'Delivered',
            'Cancelled',
            'Partially Cancelled',
            'Return Requested',
            'Returned',
            'Return Rejected'
        ]
    }
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export default Order;

