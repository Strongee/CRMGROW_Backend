const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MaterialThemeSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    color: { type: String, default: '#FFFFFF' },
    font_color: { type: String, default: '#000000' },
    role: String,
    company: String,
    priority: { type: Number, default: 1000 },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('material_theme', MaterialThemeSchema);
