const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv').config();
const path = require('path');
const multer = require('multer');
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
// In your server code (first document)
app.post('/api/create-payment-intent', async(req, res) => {
    try {
        // Log the request body for debugging
        console.log("Create payment intent request:", req.body);

        // Extract amount from request body or set default
        const amount = req.body.amount || 500;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: req.body.productName || "Book Purchase"
                    },
                    unit_amount: Math.round(amount * 100) // Convert to smallest currency unit (paise)
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/cart.html`
        });

        console.log("Created session:", session.id, "URL:", session.url);
        res.json({ url: session.url });
    } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async(req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || user.password !== password) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        res.json({ message: 'Login successful', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/orders', async(req, res) => {
    try {
        const { userId, items, subtotal, shipping, pointsUsed, pointsDiscount, total, paymentId } = req.body;
        const order = new Order({ userId, items, subtotal, shipping, pointsUsed, pointsDiscount, total, paymentId, status: 'paid' });
        if (userId && pointsUsed > 0) {
            const user = await User.findById(userId);
            if (user && user.points >= pointsUsed) {
                user.points -= pointsUsed;
                await user.save();
            }
        }
        res.status(201).json({ order: await order.save() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/:userId/orders', async(req, res) => {
    try {
        const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
});
// Add this to the server.js file
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

// Start server
app.listen(3000, () => console.log('Server running on port 3000'));