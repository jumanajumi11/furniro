import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
    size:     { type: String, trim: true, default: '' },
    color:    { type: String, trim: true, default: '' },
    colorId:  { type: mongoose.Schema.Types.ObjectId, default: null },
    sku:      { type: String, trim: true, default: '' },
    stock:    { type: Number, default: 0, min: 0 },
    price:    { type: Number, default: 0, min: 0 }
}, { _id: true });

const productSchema = new mongoose.Schema({

    productName: {
        type:     String,
        required: [true, 'Product name is required'],
        trim:     true
    },

    slug: {
        type:   String,
        trim:   true,
        unique: true,
        sparse: true
    },

    description: {
        type:     String,
        trim:     true,
        default:  ''
    },
    
    category: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'Category',
        required: [true, 'Category is required']
    },



    regularPrice: {
        type:     Number,
        required: [true, 'Regular price is required'],
        min:      [0, 'Price cannot be negative']
    },

    salePrice: {
        type:    Number,
        default: null,
        min:     [0, 'Sale price cannot be negative']
    },

    stock: {
        type:    Number,
        default: 0,
        min:     [0, 'Stock cannot be negative']
    },

    images: {
        type:    [String],
        default: []
    },

    variants: {
        type:    [variantSchema],
        default: []
    },
    colors: {
        type:    [new mongoose.Schema({
            name:   { type: String, required: true, trim: true },
            hex:    { type: String, required: true, match: /^#([A-Fa-f0-9]{6})$/ },
            images: { type: [String], default: [] },
            isDefault: { type: Boolean, default: false }
        }, { _id: true })],
        default: []
    },


    isListed: {
        type:    Boolean,
        default: true
    },

    isDeleted: {
        type:    Boolean,
        default: false
    },
    brand: {
        type:    String,
        trim:    true,
        default: 'Furniro'
    }

}, { timestamps: true });

productSchema.pre('save', async function () {
    if (this.isModified('productName')) {
        let baseSlug = this.productName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        let slug      = baseSlug;
        let suffix    = 1;
        const Product = this.constructor;

        while (await Product.findOne({ slug, _id: { $ne: this._id } })) {
            slug = `${baseSlug}-${suffix++}`;
        }
        this.slug = slug;
    }
});

productSchema.pre('save', async function () {
    if (this.variants && this.variants.length > 0) {
        const seen = new Set();
        for (const v of this.variants) {
            const key = `${(v.size || '').trim().toLowerCase()}|${(v.color || '').trim().toLowerCase()}`;
            if (seen.has(key)) {
                const err = new Error('Variant with this size and color already exists.');
                err.name = 'ValidationError';
                throw err;
            }
            seen.add(key);
        }

        this.stock = this.variants.reduce((sum, v) => sum + (v.stock || 0), 0);

        const prices = this.variants.map(v => v.price).filter(p => typeof p === 'number' && p >= 0);
        if (prices.length > 0) {
            this.regularPrice = Math.min(...prices);
        }
    }
});

productSchema.virtual('stockStatus').get(function () {
    if (this.stock === 0)       return 'out-of-stock';
    if (this.stock <= 5)        return 'low-stock';
    return 'in-stock';
});

productSchema.set('toObject',  { virtuals: true });
productSchema.set('toJSON',    { virtuals: true });

const Product =
    mongoose.models.Product ||
    mongoose.model('Product', productSchema);

export default Product;