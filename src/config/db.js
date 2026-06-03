import mongoose from'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/furnitureDB');
    console.log('MongoDB Connected ✅');

   

  } catch (error) {
    console.log('DB Error:', error);
    process.exit(1);
  }
};

export default connectDB;