const mongoose = require('mongoose');

const Payment = mongoose.model('payment',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    customer_id: String,
    plan_id: String, 
    token: String,
    card_brand: String,
    exp_year: String,
    exp_month: String,
    last4: String,
    active: { type: Boolean, default: false},  
    updated_at: Date,
    created_at: Date,
 });

 module.exports = Payment
