// src/services/product/seed.service.js
import Product  from '../../models/product.js';
import Category from '../../models/category.js';
import Coupon   from '../../models/coupon.js';
import Review   from '../../models/review.js';
import Order    from '../../models/order.js';
import User     from '../../models/user.js';

/**
 * Seed the required categories, products, coupons, default reviews,
 * and a mock order if the database is empty or requires setup.
 */
export const seedProductsIfEmpty = async () => {
    try {
        const requiredCategories = [
            { name: 'L Shaped Sofa',  description: 'Premium L-shaped modular sofas' },
            { name: '3 Seater Sofa',  description: 'Elegant 3-seater luxury sofas'  },
            { name: 'Recliner Sofa',  description: 'Comfortable dynamic recliners'   }
        ];

        // 1. Ensure each required category exists
        for (const cat of requiredCategories) {
            const exists = await Category.findOne({
                name: { $regex: `^${cat.name}$`, $options: 'i' }
            });
            if (!exists) {
                console.log(`Seeding category: ${cat.name}`);
                await Category.create({ name: cat.name, description: cat.description, isListed: true, isDeleted: false });
            }
        }

        // 2. Only seed sample products if there are NO products at all
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            // Get category ObjectIds
            const dbCategories = await Category.find({ isDeleted: false }).lean();
            const catMap = {};
            dbCategories.forEach(c => { catMap[c.name.toLowerCase()] = c._id; });

            const sampleProducts = [
                {
                    productName:  'Nordic L Shaped Sofa',
                    category:     catMap['l shaped sofa'],
                    description:  'High quality Nordic L Shaped Sofa designed for ultimate comfort and elegant living rooms. Constructed with solid wood frame and premium stain-resistant fabric. Available in multiple color and size variations.',
                    regularPrice: 45999,
                    salePrice:    39999,
                    stock:        12,
                    isListed:     true,
                    images:       [
                        'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'
                    ],
                    colors: [
                        {
                            name: 'Classic Gray',
                            hex: '#808080',
                            images: [
                                'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'
                            ],
                            isDefault: true
                        },
                        {
                            name: 'Sand Beige',
                            hex: '#F5F5DC',
                            images: [
                                'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80'
                            ],
                            isDefault: false
                        }
                    ],
                    variants: [
                        { size: 'Standard', color: 'Classic Gray', price: 39999, stock: 7, sku: 'NORDIC-GRY-STD' },
                        { size: 'Large', color: 'Classic Gray', price: 44999, stock: 5, sku: 'NORDIC-GRY-LRG' },
                        { size: 'Standard', color: 'Sand Beige', price: 39999, stock: 0, sku: 'NORDIC-BEG-STD' } // Out of stock to test disabled select
                    ]
                },
                {
                    productName:  'Premium Recliner Sofa',
                    category:     catMap['recliner sofa'],
                    description:  'Experience maximum relaxation with our Premium Recliner Sofa. Features solid steel mechanism, high density memory foam, and top-grain leather matching upholstery.',
                    regularPrice: 38999,
                    salePrice:    34999,
                    stock:        8,
                    isListed:     true,
                    images:       [
                        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80'
                    ],
                    colors: [
                        {
                            name: 'Charcoal Black',
                            hex: '#1A1A1A',
                            images: [
                                'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80'
                            ],
                            isDefault: true
                        }
                    ],
                    variants: [
                        { size: 'Single Seater', color: 'Charcoal Black', price: 34999, stock: 8, sku: 'REC-BLK-1S' }
                    ]
                },
                {
                    productName:  'Luxury 3 Seater Sofa',
                    category:     catMap['3 seater sofa'],
                    description:  'A gorgeous luxury 3 Seater Sofa that fits perfectly in any modern home setting. Features deep button tufting, velvet fabric upholstery, and gold-plated metal legs.',
                    regularPrice: 29999,
                    salePrice:    26999,
                    stock:        15,
                    isListed:     true,
                    images:       [
                        'https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=800&q=80',
                        'https://images.unsplash.com/photo-1506898667547-42e22a46e125?auto=format&fit=crop&w=800&q=80'
                    ],
                    colors: [
                        {
                            name: 'Royal Blue',
                            hex: '#002366',
                            images: [
                                'https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=800&q=80'
                            ],
                            isDefault: true
                        },
                        {
                            name: 'Emerald Green',
                            hex: '#50C878',
                            images: [
                                'https://images.unsplash.com/photo-1506898667547-42e22a46e125?auto=format&fit=crop&w=800&q=80'
                            ],
                            isDefault: false
                        }
                    ],
                    variants: [
                        { size: 'Standard', color: 'Royal Blue', price: 26999, stock: 10, sku: 'LUX-BLU-STD' },
                        { size: 'Standard', color: 'Emerald Green', price: 27999, stock: 5, sku: 'LUX-GRN-STD' }
                    ]
                }
            ];

            for (const prod of sampleProducts) {
                if (prod.category) {
                    console.log(`Seeding product: ${prod.productName}`);
                    await Product.create(prod);
                }
            }
        }

        // 3. Seed Coupons if empty
        const couponCount = await Coupon.countDocuments();
        if (couponCount === 0) {
            console.log('Seeding discount coupons...');
            const expiry = new Date();
            expiry.setFullYear(expiry.getFullYear() + 1); // 1 year from now

            await Coupon.insertMany([
                { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minPurchase: 10000, expiryDate: expiry, isActive: true },
                { code: 'FURNIROFLAT', discountType: 'flat', discountValue: 5000, minPurchase: 30000, expiryDate: expiry, isActive: true },
                { code: 'FREESHIP', discountType: 'flat', discountValue: 1500, minPurchase: 5000, expiryDate: expiry, isActive: true }
            ]);
        }

        // 4. Seed Default Reviews if empty
        const reviewCount = await Review.countDocuments();
        const firstProduct = await Product.findOne().lean();
        const firstUser = await User.findOne().lean();

        if (reviewCount === 0 && firstProduct && firstUser) {
            console.log('Seeding default reviews for the first product...');
            await Review.insertMany([
                {
                    productId: firstProduct._id,
                    userId:    firstUser._id,
                    userName:  'Emma Watson',
                    rating:    5,
                    title:     'Outstanding comfort and premium feel!',
                    comment:   'The delivery was fast, and the sofa quality exceeded my expectations. The fabric feels very soft, and the cushions are thick and supportive. Highly recommended!',
                    images:    ['https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'],
                    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
                },
                {
                    productId: firstProduct._id,
                    userId:    firstUser._id,
                    userName:  'John Doe',
                    rating:    4,
                    title:     'Great sofa, but color is slightly darker',
                    comment:   'Extremely comfortable and sturdy. The Sand Beige color looks great, though in direct sunlight it is a bit darker than the website pictures. Overall, very satisfied.',
                    images:    [],
                    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
                }
            ]);
        }

        // 5. Seed a mock Delivered Order for the first user to allow verified purchaser review testing
        if (firstUser && firstProduct) {
            const orderExists = await Order.findOne({ userId: firstUser._id, status: 'Delivered' });
            if (!orderExists) {
                console.log(`Seeding delivered order for user ${firstUser.email} to enable review testing...`);
                // Let's grab the default variant
                const variantId = firstProduct.variants && firstProduct.variants.length > 0
                    ? firstProduct.variants[0]._id
                    : new mongoose.Types.ObjectId();

                const price = firstProduct.salePrice || firstProduct.regularPrice || 1000;
                const subtotal = price * 1;
                const tax = Math.round(subtotal * 0.18);
                const shippingCharge = 150;
                const grandTotal = subtotal + tax + shippingCharge;

                await Order.create({
                    userId: firstUser._id,
                    orderNumber: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
                    items: [{
                        productId: firstProduct._id,
                        variantId: variantId,
                        quantity: 1,
                        price: price,
                        status: 'Delivered'
                    }],
                    shippingAddress: {
                        name: 'John Doe',
                        phone: '9876543210',
                        house: 'Flat 101, Elite Residency',
                        locality: 'Silicon Valley',
                        area: 'Whitefield',
                        city: 'Bangalore',
                        state: 'Karnataka',
                        pincode: '560066'
                    },
                    paymentMethod: 'COD',
                    paymentStatus: 'Paid',
                    subtotal: subtotal,
                    tax: tax,
                    shippingCharge: shippingCharge,
                    grandTotal: grandTotal,
                    status: 'Delivered'
                });
            }
        }

        console.log('Seeding process completed ✅');
    } catch (err) {
        console.error('Seeding failed:', err.message);
    }
};

export default seedProductsIfEmpty;
