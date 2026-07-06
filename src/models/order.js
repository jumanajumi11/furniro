import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId }, // Variant ID is optional for products without variants
    quantity:  { type: Number, required: true },
    price:     { type: Number, required: true },
    color:     { type: String }, // selected color name at purchase
    size:      { type: String }, // selected size at purchase
    image:     { type: String }, // image path/filename used for variant at purchase
    status: {
        type: String,
        default: 'Pending',
        enum: ['Pending', 'Processing', 'Shipped', 'Out For Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned', 'Return Rejected']
    },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    refundAmount: { type: Number },
    deliveredAt: { type: Date },
    returnedAt: { type: Date },
    returnReason: { type: String },
    returnRequestDate: { type: Date },
    returnStatus: { type: String, enum: ['None', 'Requested', 'Approved', 'Rejected', 'Returned'], default: 'None' }
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
    razorpayOrderId:   { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    notes:         { type: String },
    cancellationReason: { type: String },
    returnReason:       { type: String },
    refundStatus:       { type: String, enum: ['None', 'Pending', 'Processed', 'Failed'], default: 'None' },
    refundedAmount:     { type: Number, default: 0 },
    refundDate:         { type: Date },
    status: {
        type: String,
        default: 'Pending Payment',
        enum: [
            'Pending Payment',
            'Payment Failed',
            'Pending',
            'Processing',
            'Shipped',
            'Out For Delivery',
            'Delivered',
            'Cancelled',
            'Partially Cancelled',
            'Return Requested',
            'Returned',
            'Return Rejected',
            'Partially Completed',
            'Partially Delivered',
            'Partially Returned'
        ]
    }
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export default Order;

