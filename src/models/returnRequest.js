import mongoose from 'mongoose';

const returnRequestItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId },
    quantity:  { type: Number, required: true },
    price:     { type: Number, required: true }
});

const returnRequestSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason:  { type: String, required: true },
    status:  { 
        type: String, 
        default: 'Requested', 
        enum: ['Requested', 'Approved', 'Rejected'] 
    },
    items: [returnRequestItemSchema],
    rejectionReason: { type: String },
    rejectedAt: { type: Date }
}, { timestamps: true });

const ReturnRequest = mongoose.models.ReturnRequest || mongoose.model('ReturnRequest', returnRequestSchema);
export default ReturnRequest;
