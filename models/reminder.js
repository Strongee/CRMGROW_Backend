const mongoose = require('mongoose');

const Reminder = mongoose.model('reminder', {
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  due_date: Date,
  type: String,
  del: { type: Boolean, default: false },
  contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
  appointment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'appointment' }],
  follow_up: [{ type: mongoose.Schema.Types.ObjectId, ref: 'follow_up' }],
  created_at: Date,
  updated_at: Date,
});

module.exports = Reminder;
