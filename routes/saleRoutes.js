const express = require('express');
const router  = express.Router();
const Sale    = require('../models/Sale');
const Product = require('../models/Product');

router.post('/', async (req, res) => {
  try {
    for (const item of req.body.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: -item.quantity } }
      );
    }

    const billNumber = 'BILL' + Date.now();
    const sale = new Sale({
      userId:      req.body.userId,
      billNumber:  billNumber,
      items:       req.body.items,
      totalAmount: req.body.totalAmount,
      sellerName:  req.body.sellerName
    });

    const newSale = await sale.save();
    res.status(201).json(newSale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    const sales  = await Sale.find({ userId: userId }).sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/lowstock', async (req, res) => {
  try {
    const userId   = req.query.userId;
    const products = await Product.find({
      userId: userId,
      $expr:  { $lte: ['$quantity', '$lowStockLimit'] }
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/expired', async (req, res) => {
  try {
    const userId   = req.query.userId;
    const products = await Product.find({
      userId:     userId,
      expiryDate: { $lte: new Date() }
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;