const express = require('express');
const router  = express.Router();
const User    = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const existing = await User.findOne({ username: req.body.username });
    if (existing) return res.status(400).json({ message: 'Username already exists!' });

    const user = new User({
      username: req.body.username,
      password: req.body.password,
      role:     req.body.role
    });
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.body.username,
      password: req.body.password
    });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({
      message:  'Login successful',
      role:     user.role,
      username: user.username,
      userId:   user._id
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;