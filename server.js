const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');

// Load environment variables first
dotenv.config();

// Initialize Stripe with API key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe')) {
    console.error('WARNING: Stripe secret key is not properly configured!');
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Error: Images only!'));
        }
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/e-aspirant', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    profileImage: { type: String },
    points: { type: Number, default: 0 },
    donations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Donation' }],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Donation Schema
const donationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    contact: { type: String, required: true },
    address: { type: String, required: true },
    photoPath: { type: String },
    bookName: { type: String, required: true },
    authorName: { type: String, required: true },
    edition: { type: String, required: true },
    amount: { type: Number, required: true },
    message: { type: String },
    date: { type: Date, default: Date.now },
    points: { type: Number, default: 10 }
});

const Donation = mongoose.model('Donation', donationSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{
        title: String,
        price: Number,
        quantity: Number
    }],
    subtotal: Number,
    shipping: Number,
    pointsUsed: Number,
    pointsDiscount: Number,
    total: Number,
    paymentId: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Routes

// Create payment intent
app.post('/api/create-payment-intent', async(req, res) => {
    try {
        const { amount, currency = 'inr', metadata = {} } = req.body;

        // Validate the amount
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }

        // Create a payment intent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe uses cents/paise
            currency,
            metadata,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Payment intent creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async(req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        // In production, verify password with bcrypt
        if (user.password !== password) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                profileImage: user.profileImage,
                points: user.points
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Save order after payment
app.post('/api/orders', async(req, res) => {
    try {
        const {
            userId,
            items,
            subtotal,
            shipping,
            pointsUsed,
            pointsDiscount,
            total,
            paymentId
        } = req.body;

        // Validation
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order items are required' });
        }

        if (typeof subtotal !== 'number' || typeof total !== 'number') {
            return res.status(400).json({ error: 'Invalid order amounts' });
        }

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Optional: Verify the payment status with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment has not been completed' });
        }

        const order = new Order({
            userId,
            items,
            subtotal,
            shipping,
            pointsUsed: pointsUsed || 0,
            pointsDiscount: pointsDiscount || 0,
            total,
            paymentId,
            status: 'paid'
        });

        // Update user points if points were used
        if (userId && pointsUsed > 0) {
            const user = await User.findById(userId);
            if (user) {
                if (user.points >= pointsUsed) {
                    user.points -= pointsUsed;
                    await user.save();
                } else {
                    return res.status(400).json({ error: 'Not enough points available' });
                }
            }
        }

        const savedOrder = await order.save();
        res.status(201).json({ order: savedOrder });
    } catch (error) {
        console.error('Save order error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user orders
app.get('/api/users/:userId/orders', async(req, res) => {
    try {
        const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get payment status
app.get('/api/payment/:paymentId/status', async(req, res) => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);

        res.json({
            status: paymentIntent.status,
            amount: paymentIntent.amount / 100, // Convert from cents/paise back to whole currency
            currency: paymentIntent.currency
        });
    } catch (error) {
        console.error('Payment status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        return res.status(400).json({ error: err.message });
    } else if (err) {
        // An unknown error occurred
        return res.status(500).json({ error: err.message });
    }
    next();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});