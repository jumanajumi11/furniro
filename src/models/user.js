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
    default: 0
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

userSchema.pre('save', function() {
  if (!this.referralCode && !this.isAdmin) {
    this.referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;