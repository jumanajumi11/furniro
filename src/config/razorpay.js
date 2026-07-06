import Razorpay from 'razorpay';

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_521479843260-8fbrcfhrf7ic3n1rnp1582qqkjlnp057',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret_key'
});

export default razorpayInstance;
