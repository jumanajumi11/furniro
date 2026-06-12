import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../src/config/db.js';
import { seedProductsIfEmpty } from '../src/services/product/seed.service.js';

async function run() {
    await connectDB();
    console.log("DB connected successfully");
    await seedProductsIfEmpty();
    console.log("Seed finished");
    process.exit(0);
}
run().catch(err => {
    console.error("Run error:", err);
    process.exit(1);
});
