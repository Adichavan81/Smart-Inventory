const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ['manager', 'seller'], 
        required: true 
    },
    // If the role is seller, this stores the Manager's MongoDB ObjectId.
    // If the role is manager, this remains null.
    manager: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);