
import mongoose from 'mongoose';
import shopService from '../../services/user/shop.service.js';
import Product from '../../models/product.js';
import { applyOffers } from '../../services/user/offer.service.js';
import Category from '../../models/category.js';
import Cart from '../../models/cart.js';
import Wishlist from '../../models/wishlist.js';
import Review from '../../models/review.js';
import Order from '../../models/order.js';
import Coupon from '../../models/coupon.js';
import { logger } from '../../utils/logger.js';
import Banner from '../../models/banner.js';

export const loadHome = async (req, res) => {
    try {
        const homeData = await shopService.getHomeProducts();
        res.render('user/home', {
            user:     req.session.user || null,
            category: homeData.categories,
            products: homeData.products
        });
    } catch (error) {
        console.error('Home Page Error:', error.message);
        res.redirect('/login');
    }
};

export const loadShop = async (req, res) => {
    try {
        const shopData = await shopService.getShopProducts(req.query);
        const shopBanner = await Banner.findOne({ page: 'shop', status: 'Active', imageUrl: { $ne: '', $exists: true } }).lean();

        res.render('user/shop', {
            user:             req.session.user || null,
            products:         shopData.products,
            categories:       shopData.categories,
            sizes:            shopData.sizes,
            currentPage:      shopData.currentPage,
            totalPages:       shopData.totalPages,
            totalProducts:    shopData.totalProducts,
            searchQuery:      shopData.searchQuery,
            selectedCategory: shopData.selectedCategory,
            selectedSizes:    shopData.selectedSizes,
            minPrice:         shopData.minPrice,
            maxPrice:         shopData.maxPrice,
            sortParam:        shopData.sortParam,
            limit:            shopData.limit,
            shopBanner
        });
    } catch (error) {
        console.error('Shop Page Error:', error.message);
        res.redirect('/');
    }
};


export const loadProductDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.redirect('/shop?error=Invalid Product ID');
        }

        const product = await Product.findById(id).populate('category').lean();
        await applyOffers(product);
        
        
        if (!product || product.isDeleted) {
            return res.redirect('/shop?error=This product is currently unavailable.');
        }

        
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);

        
        let isVerifiedPurchaser = false;
        if (userId) {
            const hasOrdered = await Order.findOne({
                userId,
                'items.productId': product._id,
                status: 'Delivered'
            }).lean();
            if (hasOrdered) {
                isVerifiedPurchaser = true;
            }
        }

        
        const reviews = await Review.find({ productId: product._id }).sort({ createdAt: -1 }).lean();
        const totalReviews = reviews.length;
        let averageRating = 0;
        const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        const ratingPercentages = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

        if (totalReviews > 0) {
            let sum = 0;
            reviews.forEach(r => {
                sum += r.rating;
                if (ratingDistribution.hasOwnProperty(r.rating)) {
                    ratingDistribution[r.rating]++;
                }
            });
            averageRating = parseFloat((sum / totalReviews).toFixed(1));
            
            
            for (let stars = 1; stars <= 5; stars++) {
                ratingPercentages[stars] = Math.round((ratingDistribution[stars] / totalReviews) * 100);
            }
        }

        
        const coupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: new Date() }
        }).lean();

       
        const allSystemSizes = (await Product.distinct('variants.size', {
            isListed: true,
            isDeleted: false
        })).filter(Boolean);

        
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isListed: true,
            isDeleted: false
        }).populate('category').limit(4).lean();
        await applyOffers(relatedProducts);

        let recentlyViewedIds = [];
        if (req.cookies.recentlyViewed) {
            try {
                recentlyViewedIds = JSON.parse(req.cookies.recentlyViewed);
            } catch (e) {
                recentlyViewedIds = [];
            }
        }

        recentlyViewedIds = [id, ...recentlyViewedIds.filter(item => item !== id)].slice(0, 5);
        res.cookie('recentlyViewed', JSON.stringify(recentlyViewedIds), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

        const recentlyViewedProducts = await Product.find({
            _id: { $in: recentlyViewedIds.filter(itemId => itemId !== id) },
            isListed: true,
            isDeleted: false
        }).populate('category').limit(4).lean();
        await applyOffers(recentlyViewedProducts);

        let isInWishlist = false;
        if (userId) {
            const wishlist = await Wishlist.findOne({ userId, products: product._id }).lean();
            if (wishlist) {
                isInWishlist = true;
            }
        }

        res.render('user/product-details', {
            user: req.session.user || null,
            product,
            allSystemSizes,
            reviews,
            totalReviews,
            averageRating,
            ratingDistribution,
            ratingPercentages,
            coupons,
            relatedProducts,
            recentlyViewedProducts,
            isVerifiedPurchaser,
            isInWishlist
        });

    } catch (error) {
        console.error('Product Details Page Error:', error.message);
        res.redirect('/shop');
    }
};

export const addReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, title, comment } = req.body;
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);

        if (!userId) {
            return res.redirect('/login?error=Please login to submit a review');
        }

        const product = await Product.findById(id).lean();
        if (!product || product.isDeleted) {
            return res.redirect('/shop?error=Product not found');
        }

        const hasOrdered = await Order.findOne({
            userId,
            'items.productId': product._id,
            status: 'Delivered'
        }).lean();

        if (!hasOrdered) {
            return res.redirect(`/shop/product/${id}?error=Only verified purchasers who received this product can write a review`);
        }

        const score = parseInt(rating);
        if (isNaN(score) || score < 1 || score > 5) {
            return res.redirect(`/shop/product/${id}?error=Rating must be between 1 and 5 stars`);
        }
        if (!title || !title.trim()) {
            return res.redirect(`/shop/product/${id}?error=Review title is required`);
        }
        if (!comment || !comment.trim()) {
            return res.redirect(`/shop/product/${id}?error=Review comment is required`);
        }

       const images = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                images.push('/upload/' + file.filename);
            });
        }

        const userName = req.session.user.name || 'Verified Buyer';

        await Review.create({
            productId: product._id,
            userId,
            userName,
            rating: score,
            title: title.trim(),
            comment: comment.trim(),
            images
        });

        res.redirect(`/shop/product/${id}?success=Review posted successfully`);

    } catch (error) {
        console.error('Add Review Error:', error.message);
        res.redirect('/shop');
    }
};


export const addToCart = async (req, res) => {
    try {
        logger.debug('\n──────────── [addToCart] START ────────────');
        logger.debug('[1] BODY received    :', req.body);

        const { productId, variantId: rawVariantId, quantity } = req.body;

        const variantId = (rawVariantId === 'null' || rawVariantId === '' || !rawVariantId)
            ? null
            : rawVariantId;

        const qty = Math.max(1, parseInt(quantity) || 1);

        const userId = req.session.user_id
            || (req.session.user ? req.session.user._id : null);

        logger.debug('[2] userId resolved  :', userId);

        if (!userId) {
            logger.debug('[2] ✗ No userId in session → 401');
            return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
        }

        logger.debug('[3] productId:', productId, '| variantId:', variantId, '| qty:', qty);

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            logger.debug('[3] ✗ Invalid ObjectId → 400');
            return res.status(400).json({ success: false, message: 'Invalid Product ID' });
        }

        const product = await Product.findById(productId);

        logger.debug('[4] product found:', product ? product.productName : 'NULL', '| isDeleted:', product?.isDeleted, '| isListed:', product?.isListed);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found in database' });
        }
        if (product.isDeleted) {
            return res.status(404).json({ success: false, message: 'This product has been removed' });
        }
        if (!product.isListed) {
            return res.status(404).json({ success: false, message: 'This product is not available' });
        }

        let selectedVariant = null;

        logger.debug('[5] variants count:', product.variants?.length || 0, '| product.stock:', product.stock);

        if (product.variants && product.variants.length > 0) {
            if (variantId) {
                selectedVariant = product.variants.id(variantId);
                if (!selectedVariant) {
                    logger.debug('[5] ✗ Supplied variantId not found → 400');
                    return res.status(400).json({ success: false, message: 'Selected variant is invalid' });
                }
            } else {
                selectedVariant = product.variants.find(v => v.stock > 0) || product.variants[0];
                logger.debug('[5] Auto-selected variant:', selectedVariant?._id, '| stock:', selectedVariant?.stock);
            }

            if (selectedVariant.stock < qty) {
                logger.debug(`[5] ✗ Variant stock (${selectedVariant.stock}) < qty (${qty}) → 400`);
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock. Only ${selectedVariant.stock} item(s) left.`
                });
            }
        } else {
            if (product.stock < qty) {
                logger.debug(`[5] ✗ Product stock (${product.stock}) < qty (${qty}) → 400`);
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock. Only ${product.stock} item(s) left.`
                });
            }
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
            logger.debug('[6] Created new cart for user');
        } else {
            logger.debug('[6] Found existing cart with', cart.items.length, 'item(s)');
        }

        const finalVariantId = selectedVariant ? selectedVariant._id : null;

        const existingItemIndex = cart.items.findIndex(item =>
            item.productId.toString() === productId.toString() &&
            (finalVariantId
                ? item.variantId && item.variantId.toString() === finalVariantId.toString()
                : !item.variantId)
        );

        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += qty;
            logger.debug(`[6] Updated existing cart item quantity to ${cart.items[existingItemIndex].quantity}`);
        } else {
            cart.items.push({ productId, variantId: finalVariantId || null, quantity: qty });
            logger.debug('[6] Added new item to cart');
        }

        await cart.save();
        logger.debug('[6] ✓ cart.save() succeeded. Total items:', cart.items.length);
        logger.debug('──────────── [addToCart] END ──────────────\n');

        return res.json({ success: true, message: 'Product added to cart successfully!' });

    } catch (error) {
        logger.error('[addToCart] CAUGHT ERROR:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


export const buyNow = async (req, res) => {
    try {
        const { productId, variantId, quantity } = req.body;
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        const qty = parseInt(quantity) || 1;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to checkout' });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid Product ID' });
        }

        const product = await Product.findById(productId);
        if (!product || product.isDeleted || !product.isListed) {
            return res.status(400).json({ success: false, message: 'This product is currently unavailable.' });
        }

        if (product.variants && product.variants.length > 0) {
            if (!variantId) {
                return res.status(400).json({ success: false, message: 'Please select a size and color' });
            }
            const selectedVariant = product.variants.id(variantId);
            if (!selectedVariant) {
                return res.status(400).json({ success: false, message: 'Selected variant is invalid' });
            }
            if (selectedVariant.stock <= 0) {
                return res.status(400).json({ success: false, message: 'The selected variant is out of stock.' });
            }
            if (selectedVariant.stock < qty) {
                return res.status(400).json({ success: false, message: `Insufficient stock. Only ${selectedVariant.stock} items left.` });
            }
        } else {
            if (product.stock <= 0) {
                return res.status(400).json({ success: false, message: 'This product is out of stock.' });
            }
            if (product.stock < qty) {
                return res.status(400).json({ success: false, message: `Insufficient stock. Only ${product.stock} items left.` });
            }
        }

        // Store Buy Now item in session
        req.session.buyNowItem = {
            productId,
            variantId: variantId || null,
            quantity: qty
        };

        return res.json({ success: true, redirectUrl: '/checkout?buyNow=true' });

    } catch (error) {
        console.error('Buy Now Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export default { loadHome, loadShop, loadProductDetails, addReview, addToCart, buyNow };
