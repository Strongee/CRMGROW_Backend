const mongoose = require('mongoose');

const Automation = mongoose.model('automation', {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  title: String,
  automations: Array,
  del: { type: Boolean, default: false },
  created_at: Date,
  updated_at: Date,
});

module.exports = Automation;
