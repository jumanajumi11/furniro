import wishlistService from '../../services/user/wishlist.service.js';
import cartService from '../../services/user/cart.service.js';

/**
 * GET Wishlist Page
 */
export const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.redirect('/login?error=Please login to view your wishlist');
        }

        // Auto-clean unlisted or deleted items in the wishlist
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

/**
 * POST Toggle Wishlist Item (AJAX)
 */
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

/**
 * POST Remove Item from Wishlist directly (AJAX)
 */
export const removeItem = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const { productId } = req.body;
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

/**
 * POST Move Item from Wishlist to Cart (AJAX)
 */
export const moveToCart = async (req, res) => {
    try {
        const userId = req.session.user_id || (req.session.user ? req.session.user._id : null);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to perform this action' });
        }

        const { productId } = req.body;
        
        // addItemToCart automatically adds the item (choosing the first available variant if it has variants)
        // and removes the item from the wishlist.
        const result = await cartService.addItemToCart(userId, productId, null, 1);
        
        return res.json({
            success: true,
            message: 'Product moved to cart successfully!',
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
