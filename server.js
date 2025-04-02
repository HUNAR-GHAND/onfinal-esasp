const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer'); // Add this

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Add this for serving uploaded files

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
            cb('Error: Images only!');
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
    donations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Donation' }], // Add this
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

// Existing Routes
app.post('/api/register', async(req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password, // In production, hash this password
            phone
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
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

app.put('/api/profile/:userId', async(req, res) => {
    try {
        const { name, phone, profileImage } = req.body;
        const userId = req.params.userId;

        const user = await User.findByIdAndUpdate(
            userId, { name, phone, profileImage }, { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/profile/:userId/password', async(req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.params.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // In production, verify current password with bcrypt
        if (user.password !== currentPassword) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword; // In production, hash this password
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// New Donation Routes

// Get all donations
app.get('/api/donations', async(req, res) => {
    try {
        const donations = await Donation.find().sort({ date: -1 });
        res.json(donations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new donation
app.post('/api/donations', upload.single('photo'), async(req, res) => {
    try {
        const {
            name,
            contact,
            address,
            bookName,
            authorName,
            edition,
            amount,
            message,
            userId
        } = req.body;

        // Create donation record
        const donation = new Donation({
            name,
            contact,
            address,
            photoPath: req.file ? `/uploads/${req.file.filename}` : null,
            bookName,
            authorName,
            edition,
            amount: Number(amount),
            message,
            points: 10
        });

        // If user is logged in, associate donation with user
        if (userId) {
            try {
                const user = await User.findById(userId);
                if (user) {
                    donation.userId = userId;
                    user.points += 10;
                    if (!user.donations) {
                        user.donations = [];
                    }
                    user.donations.push(donation._id);
                    await user.save();
                }
            } catch (userErr) {
                console.error('Error updating user:', userErr);
                // Continue even if user update fails
            }
        }

        const savedDonation = await donation.save();

        res.status(201).json({
            donation: savedDonation,
            message: 'Donation submitted successfully'
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get user's donation history
app.get('/api/users/:userId/donations', async(req, res) => {
    try {
        const userId = req.params.userId;
        const donations = await Donation.find({ userId }).sort({ date: -1 });
        res.json(donations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get user points
app.get('/api/users/:userId/points', async(req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ points: user.points });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});