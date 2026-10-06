require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const User = require('./models/User');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const { authenticate, authorize } = require('./middleware/auth');

const app = express();

// Enable Cross-Origin Resource Sharing for app network requests
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.error('DB Connection Error:', err));


// ==========================================
// ROOT HEALTH CHECK ROUTE
// ==========================================
app.get('/', (req, res) => {
    res.json({ message: 'Smart Inventory API is running successfully!' });
});


// ==========================================
// 1. AUTHENTICATION & REGISTRATION
// ==========================================

// Manager Signup (Store owner registers first)
app.post('/api/auth/register-manager', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const manager = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'manager',
            manager: null
        });

        res.status(201).json({ message: 'Manager account created successfully', managerId: manager._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Seller Creation (Manager registers employees directly)
app.post('/api/auth/register-seller', authenticate, authorize('manager'), async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Seller automatically gets tied to the logged-in manager's ID
        const seller = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'seller',
            manager: req.user.id
        });

        res.status(201).json({ message: 'Seller registered successfully under your management', seller });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Universal Login Route (App logs in here)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        // Target Manager ID scoping logic:
        // - Manager -> managerId = user._id
        // - Seller  -> managerId = user.manager (Assigned owner manager's ID)
        const managerId = user.role === 'manager' ? user._id : user.manager;

        const token = jwt.sign(
            { id: user._id, role: user.role, managerId },
            process.env.JWT_SECRET || 'secretkey',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                managerId
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 2. INVENTORY CONTROL
// ==========================================

// Add Product (Manager only)
app.post('/api/products', authenticate, authorize('manager'), async (req, res) => {
    try {
        const { name, quantity, price } = req.body;

        const product = await Product.create({
            name,
            quantity,
            price,
            manager: req.user.id
        });

        res.status(201).json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update Product / Stock (Manager only)
app.put('/api/products/:id', authenticate, authorize('manager'), async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, manager: req.user.id },
            req.body,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found or unauthorized.' });
        }

        res.json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get Products (Returns ONLY stock belonging to the logged-in user's manager)
app.get('/api/products', authenticate, async (req, res) => {
    try {
        const products = await Product.find({ manager: req.user.managerId });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 3. SALES & TRANSACTIONS
// ==========================================

// Process Sale (Seller or Manager)
app.post('/api/sales', authenticate, authorize('seller', 'manager'), async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // Validates product belongs to user's assigned manager inventory
        const product = await Product.findOne({ _id: productId, manager: req.user.managerId });
        if (!product) {
            return res.status(404).json({ error: 'Product unavailable in your store.' });
        }

        if (product.quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock available.' });
        }

        product.quantity -= quantity;
        await product.save();

        const sale = await Sale.create({
            product: productId,
            seller: req.user.id,
            manager: req.user.managerId,
            quantity,
            totalPrice: product.price * quantity
        });

        res.status(201).json(sale);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get Sales History
app.get('/api/sales', authenticate, async (req, res) => {
    try {
        const query = req.user.role === 'manager' 
            ? { manager: req.user.id } 
            : { seller: req.user.id, manager: req.user.managerId };

        const sales = await Sale.find(query)
            .populate('product', 'name price')
            .populate('seller', 'name email');

        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listen on port provided by Render environment or default to 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));