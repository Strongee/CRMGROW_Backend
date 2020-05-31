const mongoose = require('mongoose');

const Label = mongoose.model(
  'label',
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    name: String,
    color: String,
    font_color: String,
    role: String,
    company: String,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = Label;
