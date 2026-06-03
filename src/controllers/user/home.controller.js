// src/controllers/user/home.controller.js
import Product  from '../../models/product.js';
import Category from '../../models/category.js';

export const loadHome = async (req, res) => {
    try {
        // ── 1. Sofa category cards (static images, dynamic links) ──
        const sofaCategories = [
            {
                name: 'L Shaped Sofa',
                img:  'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776920338/image_113_wlmvvt.png'
            },
            {
                name: '3 Seater Sofa',
                img:  'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921475/image_114_kmk1ux.png'
            },
            {
                name: 'Recliner Sofa',
                img:  'https://res.cloudinary.com/dp9odkfmd/image/upload/v1776921535/image_115_uu5fck.png'
            }
        ];

        // ── 2. Fetch latest listed, non-deleted products ────────────
        const products = await Product.find({
            isListed:  true,
            isDeleted: false
        })
        .populate('category', 'name')   // populate category so name is available
        .sort({ createdAt: -1 })        // newest first
        .limit(9)                       // 3 per row × 3 rows on homepage
        .lean();

        res.render('user/home', {
            user:    req.session.user || null,
            category: sofaCategories,   // sofa-type cards in the "Shop by type" section
            products                    // dynamic product grid
        });

    } catch (error) {
        console.error('Home Page Error:', error.message);
        res.redirect('/login');
    }
};