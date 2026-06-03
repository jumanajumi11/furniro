import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Product from './src/models/product.js';
import connectDB from './src/config/db.js';

async function check() {
    await connectDB();
    const products = await Product.find({}).lean();
    console.log("TOTAL PRODUCTS:", products.length);
    for (const p of products) {
        console.log(`Product: ID=${p._id}, Name="${p.productName}"`);
        if (p.productName.includes("'") || p.description.includes("'")) {
            console.log("  -> HAS SINGLE QUOTES!");
        }
        if (p.description.includes("\n") || p.description.includes("\r")) {
            console.log("  -> HAS NEWLINES!");
        }
    }
    process.exit(0);
}
check();
