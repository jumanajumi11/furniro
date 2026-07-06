
import Product  from '../../models/product.js';
import Category from '../../models/category.js';
import Banner   from '../../models/banner.js';
import { applyOffers } from '../../services/user/offer.service.js';

export const loadHome = async (req, res) => {
    try {
        
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

        const products = await Product.find({
            isListed:  true,
            isDeleted: false
        })
        .populate('category', 'name')   
        .sort({ createdAt: -1 })        
        .limit(9)                       
        .lean();

        await applyOffers(products);

        // Fetch active home banners with images
        const banners = await Banner.find({ page: 'home', status: 'Active', imageUrl: { $ne: '', $exists: true } }).lean();

        res.render('user/home', {
            user:    req.session.user || null,
            category: sofaCategories,   
            products,
            banners
        });

    } catch (error) {
        console.error('Home Page Error:', error.message);
        res.redirect('/login');
    }
};