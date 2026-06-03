import * as productService from '../../services/admin/product.service.js';
import Category  from '../../models/category.js';

// ────────────────────────────────────────────────────────────────────
// 1. LIST  /admin/products
// ────────────────────────────────────────────────────────────────────
export const listProducts = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 10, sort = 'newest', category = '', status = 'all' } = req.query;

        const [result, stats, categories] = await Promise.all([
            productService.listProducts({ search, page, limit, sort, category, status }),
            productService.getProductStats(),
            Category.find({ isDeleted: false, isListed: true }).sort({ name: 1 }).lean()
        ]);

        res.render('admin/products', {
            activePage:     'products',
            products:       result.products,
            search:         result.search,
            sort:           result.sort,
            currentPage:    result.currentPage,
            totalPages:     result.totalPages,
            total:          result.total,
            limit:          result.limit,
            filterCategory: result.category,
            filterStatus:   result.status,
            categories,
            stats
        });
    } catch (err) {
        console.error('listProducts error:', err);
        res.status(500).send('Server Error');
    }
};

// ────────────────────────────────────────────────────────────────────
// 2. SHOW Add-Product page  GET /admin/products/add
// ────────────────────────────────────────────────────────────────────
export const showAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({ isDeleted: false, isListed: true }).sort({ name: 1 }).lean();
        res.render('admin/product-add', { activePage: 'products', categories, errors: {}, old: {} });
    } catch (err) {
        console.error('showAddProduct error:', err);
        res.status(500).send('Server Error');
    }
};

// ────────────────────────────────────────────────────────────────────
// 3. CREATE  POST /admin/products
// ────────────────────────────────────────────────────────────────────
export const createProduct = async (req, res) => {
    try {
        const { productName, description, category, brand, regularPrice, salePrice, stock, isListed } = req.body;

        // Debug: log received files
        console.log('[createProduct] Files received:', (req.files || []).length);
        (req.files || []).forEach(f => console.log(`  ${f.fieldname}: ${f.originalname} (${f.mimetype}, ${f.size} bytes) -> ${f.filename}`));
        console.log('[createProduct] Colors JSON:', req.body.colors ? req.body.colors.substring(0, 200) : 'EMPTY');

        // Parse colors from JSON body field
        let colors = []
        try { colors = JSON.parse(req.body.colors || '[]'); } catch (_) {}
        // Validate color fields (name, hex, default uniqueness)
        const hexRegex = /^#([A-Fa-f0-9]{6})$/;
        let defaultCount = 0;
        for (const col of colors) {
            if (!col.name || !col.name.trim()) {
                return res.status(400).json({ success: false, message: 'All colors must have a name.', errors: { colors: 'All colors must have a name.' } });
            }
            if (!col.hex || !hexRegex.test(col.hex)) {
                return res.status(400).json({ success: false, message: `Color "${col.name}" must have a valid hex code.`, errors: { colors: `Invalid hex for "${col.name}".` } });
            }
            if (col.isDefault) defaultCount++;
        }
        if (defaultCount > 1) {
            return res.status(400).json({ success: false, message: 'Only one default color can be set.', errors: { colors: 'Multiple default colors.' } });
        }
        // Map uploaded files to colors
        colors.forEach(color => {
            const fieldName = `colorImages_${color.tempIndex}`;
            const colorFiles = (req.files || []).filter(f => f.fieldname === fieldName);
            const newColorImages = colorFiles.map(f => f.filename);
            const keptImages = color.existingImages || [];
            color.images = [...keptImages, ...newColorImages];
            delete color.tempIndex;
            delete color.existingImages;
        });

        // Parse variants from JSON body field
        let variants = [];
        try { variants = JSON.parse(req.body.variants || '[]'); } catch (_) {}

        // Validate variants (size, color, price, stock) and ensure color exists
        if (variants && variants.length) {
            const seen = new Set();
            const colorNames = colors.map(c => c.name.toLowerCase());
            for (const v of variants) {
                if (!v.size || !v.color || v.price == null || v.stock == null) {
                    return res.status(400).json({ success: false, message: 'Each variant must include size, color, price, and stock.', errors: { variants: 'Invalid variant data.' } });
                }
                if (!colorNames.includes(v.color.toLowerCase())) {
                    return res.status(400).json({ success: false, message: `Variant color "${v.color}" does not match any defined color.`, errors: { variants: 'Invalid color for variant.' } });
                }
                const key = `${(v.size || '').trim().toLowerCase()}|${(v.color || '').trim().toLowerCase()}`;
                if (seen.has(key)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Variant with this size and color already exists.',
                        errors: { variants: 'Variant with this size and color already exists.' }
                    });
                }
                seen.add(key);
            }
        }
// Validate colors and image count
        if (colors.length < 1) {
            return res.status(400).json({ success: false, message: 'At least one color is required.', errors: { colors: 'At least one color is required.' } });
        }
        for (const col of colors) {
            if (!col.name || !col.name.trim()) {
                return res.status(400).json({ success: false, message: 'All colors must have a name.', errors: { colors: 'All colors must have a name.' } });
            }
            if (col.images.length < 1) {
                return res.status(400).json({ success: false, message: `Color "${col.name}" must have at least 1 image.`, errors: { colors: `Color "${col.name}" must have at least 1 image.` } });
            }
            if (col.images.length > 3) {
                return res.status(400).json({ success: false, message: `Color "${col.name}" can have at most 3 images.`, errors: { colors: `Color "${col.name}" can have at most 3 images.` } });
            }
        }

        // Set default color's images on main product images list
        let defaultColor = colors.find(c => c.isDefault);
        if (!defaultColor && colors.length > 0) {
            defaultColor = colors[0];
            defaultColor.isDefault = true;
        }
        const images = defaultColor ? defaultColor.images : [];

        const product = await productService.createProduct({
            productName, description, category, brand,
            regularPrice, salePrice, stock,
            images, variants, colors,
            isListed: isListed !== 'false'
        });

        return res.json({ success: true, message: 'Product created successfully.', productId: product._id });
    } catch (err) {
        console.error('createProduct error:', err);
        const status = err.statusCode || 400;
        return res.status(status).json({ success: false, message: err.message, errors: err.validationErrors || {} });
    }
};

// ────────────────────────────────────────────────────────────────────
// 4. SHOW Edit-Product page  GET /admin/products/:id/edit
// ────────────────────────────────────────────────────────────────────
export const showEditProduct = async (req, res) => {
    try {
        const [product, categories] = await Promise.all([
            productService.getProduct(req.params.id),
            Category.find({ isDeleted: false, isListed: true }).sort({ name: 1 }).lean()
        ]);
        res.render('admin/product-edit', { activePage: 'products', product, categories, errors: {}, old: {} });
    } catch (err) {
        console.error('showEditProduct error:', err);
        res.redirect('/admin/products');
    }
};

// ────────────────────────────────────────────────────────────────────
// 5. UPDATE  PUT /admin/products/:id
// ────────────────────────────────────────────────────────────────────
export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { productName, description, category, brand, regularPrice, salePrice, stock, isListed } = req.body;

        // Debug: log received files
        console.log('[updateProduct] Files received:', (req.files || []).length);
        (req.files || []).forEach(f => console.log(`  ${f.fieldname}: ${f.originalname} (${f.mimetype}, ${f.size} bytes) -> ${f.filename}`));
        console.log('[updateProduct] Colors JSON:', req.body.colors ? req.body.colors.substring(0, 200) : 'EMPTY');

        // Parse colors from JSON body field
        let colors = [];
        try { colors = JSON.parse(req.body.colors || '[]'); } catch (_) {}
        // Validate color fields (name, hex, default uniqueness)
        const hexRegex = /^#([A-Fa-f0-9]{6})$/;
        let defaultCount = 0;
        for (const col of colors) {
            if (!col.name || !col.name.trim()) {
                return res.status(400).json({ success: false, message: 'All colors must have a name.', errors: { colors: 'All colors must have a name.' } });
            }
            if (!col.hex || !hexRegex.test(col.hex)) {
                return res.status(400).json({ success: false, message: `Color "${col.name}" must have a valid hex code.`, errors: { colors: `Invalid hex for "${col.name}".` } });
            }
            if (col.isDefault) defaultCount++;
        }
        if (defaultCount > 1) {
            return res.status(400).json({ success: false, message: 'Only one default color can be set.', errors: { colors: 'Multiple default colors.' } });
        }
        // Map uploaded files to colors and merge with existing images
        colors.forEach(color => {
            const fieldName = `colorImages_${color.tempIndex}`;
            const colorFiles = (req.files || []).filter(f => f.fieldname === fieldName);
            const newColorImages = colorFiles.map(f => f.filename);
            const keptImages = color.existingImages || [];
            color.images = [...keptImages, ...newColorImages];
            delete color.tempIndex;
            delete color.existingImages;
        });



        // Parse variants from JSON body field
        let variants = [];
        try { variants = JSON.parse(req.body.variants || '[]'); } catch (_) {}
        // Validate variants (size, color, price, stock) and ensure color exists
        if (variants && variants.length) {
            const seen = new Set();
            const colorNames = colors.map(c => c.name.toLowerCase());
            for (const v of variants) {
                if (!v.size || !v.color || v.price == null || v.stock == null) {
                    return res.status(400).json({ success: false, message: 'Each variant must include size, color, price, and stock.', errors: { variants: 'Invalid variant data.' } });
                }
                if (!colorNames.includes(v.color.toLowerCase())) {
                    return res.status(400).json({ success: false, message: `Variant color "${v.color}" does not match any defined color.`, errors: { variants: 'Invalid color for variant.' } });
                }
                const key = `${(v.size || '').trim().toLowerCase()}|${(v.color || '').trim().toLowerCase()}`;
                if (seen.has(key)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Variant with this size and color already exists.',
                        errors: { variants: 'Variant with this size and color already exists.' }
                    });
                }
                seen.add(key);
            }
        }
        // Validate colors and image count
        if (colors.length < 1) {
            return res.status(400).json({ success: false, message: 'At least one color is required.', errors: { colors: 'At least one color is required.' } });
        }
        for (const col of colors) {
            if (!col.name || !col.name.trim()) {
                return res.status(400).json({ success: false, message: 'All colors must have a name.', errors: { colors: 'All colors must have a name.' } });
            }
            if (col.images.length < 1) {
                return res.status(400).json({ success: false, message: `Color "${col.name}" must have at least 1 image.`, errors: { colors: `Color "${col.name}" must have at least 1 image.` } });
            }
            if (col.images.length > 3) {
                return res.status(400).json({ success: false, message: `Color "${col.name}" can have at most 3 images.`, errors: { colors: `Color "${col.name}" can have at most 3 images.` } });
            }
        }

        // Set default color's images on main product images list
        let defaultColor = colors.find(c => c.isDefault);
        if (!defaultColor && colors.length > 0) {
            defaultColor = colors[0];
            defaultColor.isDefault = true;
        }
        const images = defaultColor ? defaultColor.images : [];

        await productService.updateProduct(id, {
            productName, 
            description, 
            category, 
            brand,
            regularPrice, 
            salePrice, 
            stock,
            images, 
            variants,
            colors,
            isListed: isListed !== 'false'
        });

        return res.json({ success: true, message: 'Product updated successfully.' });
    } catch (err) {
        console.error('updateProduct error:', err);
        const status = err.statusCode || 400;
        return res.status(status).json({ success: false, message: err.message, errors: err.validationErrors || {} });
    }
};

// ────────────────────────────────────────────────────────────────────
// 6. TOGGLE LISTING  PATCH /admin/products/:id/toggle
// ────────────────────────────────────────────────────────────────────
export const toggleProductListing = async (req, res) => {
    try {
        const product = await productService.toggleProductListing(req.params.id);
        return res.json({ success: true, isListed: product.isListed, message: product.isListed ? 'Product is now active.' : 'Product is now hidden.' });
    } catch (err) {
        console.error('toggleProductListing error:', err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────────────────────
// 7. SOFT DELETE  DELETE /admin/products/:id
// ────────────────────────────────────────────────────────────────────
export const deleteProduct = async (req, res) => {
    try {
        await productService.softDeleteProduct(req.params.id);
        return res.json({ success: true, message: 'Product deleted successfully.' });
    } catch (err) {
        console.error('deleteProduct error:', err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────────────────────
// 8. CHECK DUPLICATE NAME  GET /admin/products/check-name
// ────────────────────────────────────────────────────────────────────
export const checkProductName = async (req, res) => {
    try {
        const { name, excludeId } = req.query;
        if (!name) return res.json({ exists: false });
        const exists = await productService.isDuplicateName(name, excludeId || null);
        return res.json({ exists });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
};
