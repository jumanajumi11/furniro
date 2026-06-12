import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
  },
  googleId: {
    type: String
  },
  image: {
    type: String,
    default: ""
  },
  phone: {
    type: String,
    default: ""
  },
  otp: { 
    type: String, 
  }, 
  isAdmin: {
    type: Boolean,
    default: false
  },
  isVerified: { 
    type: Boolean, 
    default: false, 
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  addresses: [{
    name: String,
    phone: String,
    pincode: String,
    state: String,
    city: String,
    locality: String,
    house: String,
    area: String,
    isDefault: { type: Boolean, default: false }
  }],
  wallet: {
    type: Number,
    default: 5000
  }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;