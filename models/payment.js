const mongoose = require('mongoose');

const Payment = mongoose.model('payment', {
  email: String,
  card_name: String,
  customer_id: String,
  card: String,
  card_id: String,
  plan_id: String,
  token: String,
  subscription: String,
  fingerprint: String,
  card_brand: String,
  bill_amount: String,
  exp_year: String,
  exp_month: String,
  last4: String,
  active: { type: Boolean, default: false },
  updated_at: Date,
  created_at: Date,
});

module.exports = Payment;
