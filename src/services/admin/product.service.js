import Product  from '../../models/product.js';
import Category from '../../models/category.js';

// ── helpers ─────────────────────────────────────────────────────────
const escapeRegex = (s) => s.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');

// ── Validation constants ─────────────────────────────────────────────
export const RULES = {
    productName: { min: 3,  max: 100 },
    description: { min: 20, max: 1000 }
};

// ── Shared field validator (used by service & controller) ────────────
export const validateProductFields = ({ productName, description, category, regularPrice, salePrice, stock }) => {
    const errors = {};

    // ── Product name ──
    const cleanName = (productName || '').trim();
    if (!cleanName) {
        errors.productName = 'Product name is required.';
    } else if (cleanName.length < RULES.productName.min) {
        errors.productName = `Product name must be at least ${RULES.productName.min} characters.`;
    } else if (cleanName.length > RULES.productName.max) {
        errors.productName = `Product name must be less than ${RULES.productName.max} characters.`;
    }

    // ── Description ──
    const cleanDesc = (description || '').trim();
    if (!cleanDesc) {
        errors.description = 'Description is required.';
    } else if (cleanDesc.length < RULES.description.min) {
        errors.description = `Description must be at least ${RULES.description.min} characters.`;
    } else if (cleanDesc.length > RULES.description.max) {
        errors.description = `Description must not exceed ${RULES.description.max} characters.`;
    }

    // ── Category ──
    if (!category) {
        errors.category = 'Please select a category.';
    }

    // ── Regular price ──
    const regularP = parseFloat(regularPrice);
    if (isNaN(regularP) || regularP < 0) {
        errors.regularPrice = 'Regular price must be a positive number.';
    } else {
        // ── Sale price ──
        const saleP = salePrice ? parseFloat(salePrice) : null;
        if (saleP !== null && !isNaN(saleP) && saleP > regularP) {
            errors.salePrice = 'Sale price cannot exceed regular price.';
        }
    }

    // ── Stock ──
    const stockVal = parseInt(stock);
    if (isNaN(stockVal) || stockVal < 0) {
        errors.stock = 'Stock quantity must be 0 or greater.';
    }

    return errors; // empty object = no errors
};

// ────────────────────────────────────────────────────────────────────
// 1. LIST  (search · filter · sort · paginate)
// ────────────────────────────────────────────────────────────────────
export const listProducts = async ({
    search   = '',
    page     = 1,
    limit    = 10,
    sort     = 'newest',
    category = '',
    status   = 'all'
} = {}) => {
    const cleanSearch   = (search || '').trim();
    const cleanPage     = Math.max(1, parseInt(page)  || 1);
    const cleanLimit    = Math.max(1, parseInt(limit) || 10);
    const skip          = (cleanPage - 1) * cleanLimit;

    const query = { isDeleted: false };

    if (cleanSearch) {
        const rx = { $regex: escapeRegex(cleanSearch), $options: 'i' };
        query.$or = [{ productName: rx }];
    }
    if (category && category !== 'all') query.category = category;
    if (status === 'active')  query.isListed = true;
    if (status === 'hidden')  query.isListed = false;

    const sortMap = {
        newest:     { createdAt: -1 },
        oldest:     { createdAt:  1 },
        az:         { productName:  1 },
        za:         { productName: -1 },
        price_asc:  { regularPrice:  1 },
        price_desc: { regularPrice: -1 }
    };
    const sortQuery = sortMap[sort] || { createdAt: -1 };

    const [products, total, totalActive, totalHidden, totalLowStock, totalOutOfStock] = await Promise.all([
        Product.find(query)
            .sort(sortQuery)
            .skip(skip)
            .limit(cleanLimit)
            .populate('category', 'name')
            .lean(),
        Product.countDocuments(query),
        Product.countDocuments({ isDeleted: false, isListed: true }),
        Product.countDocuments({ isDeleted: false, isListed: false }),
        Product.countDocuments({ isDeleted: false, stock: { $gt: 0, $lte: 5 } }),
        Product.countDocuments({ isDeleted: false, stock: 0 })
    ]);

    return {
        products,
        total,
        totalPages:     Math.ceil(total / cleanLimit) || 1,
        currentPage:    cleanPage,
        limit:          cleanLimit,
        search:         cleanSearch,
        sort,
        category,
        status,
        totalActive,
        totalHidden,
        totalLowStock,
        totalOutOfStock
    };
};

// ────────────────────────────────────────────────────────────────────
// 2. GET ONE
// ────────────────────────────────────────────────────────────────────
export const getProduct = async (id) => {
    const product = await Product
        .findOne({ _id: id, isDeleted: false })
        .populate('category', '_id name')
        .lean();
    if (!product) {
        const e = new Error('Product not found'); e.statusCode = 404; throw e;
    }
    return product;
};

// ────────────────────────────────────────────────────────────────────
// 3. DUPLICATE-NAME CHECK  (case-insensitive, excluding self)
// ────────────────────────────────────────────────────────────────────
export const isDuplicateName = async (name, excludeId = null) => {
    const cleanName = (name || '').trim();
    if (!cleanName) return false;
    const q = {
        productName: { $regex: `^${escapeRegex(cleanName)}$`, $options: 'i' },
        isDeleted:   false
    };
    if (excludeId) q._id = { $ne: excludeId };
    return !!(await Product.findOne(q).lean());
};

// ────────────────────────────────────────────────────────────────────
// 4. CREATE
// ────────────────────────────────────────────────────────────────────
// 4. CREATE
// ────────────────────────────────────────────────────────────────────
export const createProduct = async ({
    productName, description, category, brand,
    regularPrice, salePrice, stock,
    images = [], variants = [], colors = [], isListed = true
}) => {
    // ── field-level validation ──
    const fieldErrors = validateProductFields({ productName, description, category, regularPrice, salePrice, stock });
    if (Object.keys(fieldErrors).length) {
        const e = new Error(Object.values(fieldErrors)[0]);
        e.validationErrors = fieldErrors;
        throw e;
    }

    const cleanName = productName.trim();
    const cleanDesc = description.trim();

    // ── duplicate check ──
    if (await isDuplicateName(cleanName)) {
        const e = new Error('A product with this name already exists.');
        e.validationErrors = { productName: e.message };
        throw e;
    }

    const regularP = parseFloat(regularPrice);
    const saleP    = salePrice ? parseFloat(salePrice) : null;
    const stockVal = parseInt(stock) || 0;

    const product = new Product({
        productName:  cleanName,
        description:  cleanDesc,
        category,
        brand:        (brand || 'Furniro').trim(),
        regularPrice: regularP,
        salePrice:    isNaN(saleP) ? null : saleP,
        stock:        stockVal,
        images,
        colors,
        isListed:     isListed !== false && isListed !== 'false'
    });

    // Link variants to color subdocuments
    const mappedVariants = variants.map(v => {
        const matchedColor = product.colors.find(c => c.name.toLowerCase() === v.color.toLowerCase());
        return {
            size: v.size,
            color: v.color,
            colorId: matchedColor ? matchedColor._id : null,
            stock: v.stock,
            price: v.price
        };
    });
    product.variants = mappedVariants;

    await product.save();
    return product;
};

// ────────────────────────────────────────────────────────────────────
// 5. UPDATE
// ────────────────────────────────────────────────────────────────────
export const updateProduct = async (id, {
    productName, description, category, brand,
    regularPrice, salePrice, stock,
    images = [], variants = [], colors = [], isListed = true
}) => {
    // ── field-level validation ──
    const fieldErrors = validateProductFields({ productName, description, category, regularPrice, salePrice, stock });
    if (Object.keys(fieldErrors).length) {
        const e = new Error(Object.values(fieldErrors)[0]);
        e.validationErrors = fieldErrors;
        throw e;
    }

    const cleanName = productName.trim();
    const cleanDesc = description.trim();

    // ── duplicate check (exclude self) ──
    if (await isDuplicateName(cleanName, id)) {
        const e = new Error('A product with this name already exists.');
        e.validationErrors = { productName: e.message };
        throw e;
    }

    const regularP = parseFloat(regularPrice);
    const saleP    = salePrice ? parseFloat(salePrice) : null;
    const stockVal = parseInt(stock) ?? 0;

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
        const e = new Error('Product not found.'); e.statusCode = 404; throw e;
    }

    product.productName = cleanName;
    product.description = cleanDesc;
    product.brand       = (brand || 'Furniro').trim();
    product.regularPrice = regularP;
    product.salePrice    = isNaN(saleP) ? null : saleP;
    product.stock       = stockVal < 0 ? 0 : stockVal;
    product.isListed    = isListed !== false && isListed !== 'false';
    if (category) product.category = category;
    product.images      = images;
    product.colors      = colors;

    // Link variants to color subdocuments
    const mappedVariants = variants.map(v => {
        const matchedColor = product.colors.find(c => c.name.trim().toLowerCase() === (v.color || '').trim().toLowerCase());
        if (!matchedColor) {
            throw new Error(
                `Variant color "${v.color}" does not match any defined color.`
            );
        }

        let existingId = null;
        // 1. Try matching by ID sent from client
        if (v.id || v._id) {
            const existing = product.variants.id(v.id || v._id);
            if (existing) {
                existingId = existing._id;
            }
        }
        
        // 2. Try matching by size & color (case-insensitive) as fallback to prevent ID regeneration on updates
        if (!existingId) {
            const existing = product.variants.find(pv => 
                (pv.size || '').trim().toLowerCase() === (v.size || '').trim().toLowerCase() &&
                (pv.color || '').trim().toLowerCase() === (v.color || '').trim().toLowerCase()
            );
            if (existing) {
                existingId = existing._id;
            }
        }

        const variantObj = {
            size: v.size,
            color: v.color,
            colorId: matchedColor ? matchedColor._id : null,
            stock: v.stock,
            price: v.price
        };

        if (existingId) {
            variantObj._id = existingId;
        }

        return variantObj;
    });
    product.variants = mappedVariants;

    await product.save();
    return product;
    
};

// ────────────────────────────────────────────────────────────────────
// 6. TOGGLE  isListed
// ────────────────────────────────────────────────────────────────────
export const toggleProductListing = async (id) => {
    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) { const e = new Error('Product not found'); e.statusCode = 404; throw e; }
    product.isListed = !product.isListed;
    await product.save();
    return product;
};

// ────────────────────────────────────────────────────────────────────
// 7. SOFT DELETE
// ────────────────────────────────────────────────────────────────────
export const softDeleteProduct = async (id) => {
    const deleted = await Product.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: { isDeleted: true, isListed: false } },
        { returnDocument:'after' }
    );
    if (!deleted) { const e = new Error('Product not found'); e.statusCode = 404; throw e; }
    return deleted;
};

// ────────────────────────────────────────────────────────────────────
// 8. STATS
// ────────────────────────────────────────────────────────────────────
export const getProductStats = async () => {
    const [total, lowStock, outOfStock, categoryCount] = await Promise.all([
        Product.countDocuments({ isDeleted: false }),
        Product.countDocuments({ isDeleted: false, stock: { $gt: 0, $lte: 5 } }),
        Product.countDocuments({ isDeleted: false, stock: 0 }),
        Category.countDocuments({ isDeleted: false, isListed: true })
    ]);
    return { total, lowStock, outOfStock, categoryCount };
};
