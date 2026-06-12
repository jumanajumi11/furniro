import wishlistService from '../../services/user/wishlist.service.js';
import cartService from '../../services/user/cart.service.js';
import Product from '../../models/product.js';
import Cart from '../../models/cart.js';


export const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to view your wishlist');
        }

        const wishlist = await wishlistService.cleanUnavailableWishlistItems(userId);
        const products = wishlist ? wishlist.products : [];

        res.render('user/wishlist', {
            user: req.session.user || null,
            products,
            success: req.query.success || null,
            error: req.query.error || null
        });

    } catch (error) {
        console.error('Load Wishlist Page Error:', error.message);
        res.redirect('/shop?error=Could not load wishlist');
    }
};


export const toggleWishlist = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to manage wishlist' });
        }

        const { productId } = req.body;
        const result = await wishlistService.toggleWishlist(userId, productId);
        
        return res.json({
            success: true,
            added: result.added,
            wishlistCount: result.wishlistCount,
            message: result.added ? 'Product added to wishlist!' : 'Product removed from wishlist!'
        });

    } catch (error) {
        console.error('AJAX Toggle Wishlist Error:', error.message);
        return res.status(400).json({ success: false, message: error.message || 'Could not toggle wishlist' });
    }
};


export const removeItem = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID missing' });
        }
        const result = await wishlistService.removeItemFromWishlist(userId, productId);

        return res.json({
            success: true,
            wishlistCount: result.wishlistCount,
            message: 'Product removed from wishlist successfully'
        });

    } catch (error) {
        console.error('AJAX Remove Wishlist Item Error:', error.message);
        return res.status(400).json({ success: false, message: error.message || 'Could not remove item' });
    }
};


export const moveToCart = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const { productId } = req.body;
        
        const product = await Product.findById(productId);
        if (!product || product.isDeleted || !product.isListed) {
            return res.status(400).json({ success: false, message: 'This product is currently unavailable' });
        }

        let targetVariantId = null;
        if (product.variants && product.variants.length > 0) {
            const selectedVariant = product.variants.find(v => v.stock > 0);
            if (!selectedVariant) {
                return res.status(400).json({ success: false, message: 'This item is currently out of stock' });
            }
            targetVariantId = selectedVariant._id;
        }

        const cart = await Cart.findOne({ userId });
        let alreadyInCart = false;
        if (cart) {
            alreadyInCart = cart.items.some(item => 
                item.productId.toString() === productId.toString() &&
                (targetVariantId 
                    ? item.variantId && item.variantId.toString() === targetVariantId.toString()
                    : !item.variantId)
            );
        }

        if (alreadyInCart) {
            return res.status(200).json({
                success: false,
                alreadyInCart: true,
                message: 'Product is already in your cart.'
            });
        }

        const result = await cartService.addItemToCart(userId, productId, targetVariantId, 1);
        
        return res.json({
            success: true,
            message: 'Product moved to cart successfully.',
            cartCount: result.cartCount,
            wishlistCount: result.wishlistCount
        });

    } catch (error) {
        console.error('AJAX Move Wishlist to Cart Error:', error.message);
        return res.status(400).json({ success: false, message: error.message || 'Could not move item to cart' });
    }
};

export default {
    loadWishlist,
    toggleWishlist,
    removeItem,
    moveToCart
};
