import mongoose from 'mongoose';
import User from '../src/models/user.js';
import Cart from '../src/models/cart.js';
import Product from '../src/models/product.js';


async function run() {
    await mongoose.connect('mongodb://127.0.0.1:27017/furnitureDB');
    console.log('Connected to DB');

    const userId = '69f31cd24bd0b1d65f2ec555'; 
    let cart = await Cart.findOne({ userId });
    console.log('Current cart:', cart);

    const products = await Product.find({ isListed: true }).limit(5);
    console.log('Found listed products:', products.length);

    if (products.length > 0) {
        const cartItems = products.map(p => ({
            productId: p._id,
            quantity: 2,
            variantId: p.variants && p.variants.length > 0 ? p.variants[0]._id : null
        }));

        if (!cart) {
            cart = new Cart({ userId, items: cartItems });
        } else {
            cart.items = cartItems;
        }
        await cart.save();
        console.log('Updated cart items count:', cart.items.length);
    }

    await mongoose.disconnect();
}
run().catch(console.error);
