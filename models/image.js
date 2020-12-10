const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ImageSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    preview: String,
    type: String,
    url: Array,
    role: String,
    priority: { type: Number, default: 1000 },
    default_edited: { type: Boolean, default: false },
    has_shared: { type: Boolean, default: false },
    default_image: { type: mongoose.Schema.Types.ObjectId, ref: 'image' },
    shared_image: { type: mongoose.Schema.Types.ObjectId, ref: 'image' },
    del: { type: Boolean, default: false },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Image = mongoose.model('image', ImageSchema);

module.exports = Image;
