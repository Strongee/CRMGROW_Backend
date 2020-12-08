const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const VideoSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    shared_members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    title: String,
    company: { type: String },
    description: String,
    converted: { type: String, default: 'none' },
    uploaded: { type: Boolean, default: false },
    thumbnail: String,
    thumbnail_path: String,
    site_image: String,
    custom_thumbnail: { type: Boolean, default: false },
    preview: String,
    recording: { type: Boolean, default: false },
    path: String,
    type: String,
    duration: Number,
    url: String,
    role: String,
    material_theme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'material_theme',
    },
    default_edited: { type: Boolean, default: false },
    default_video: { type: mongoose.Schema.Types.ObjectId, ref: 'video' },
    has_parent: { type: Boolean, default: false },
    priority: { type: Number, default: 1000 },
    del: { type: Boolean, default: false },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

VideoSchema.index({ user: 1 });
const Video = mongoose.model('video', VideoSchema);

module.exports = Video;
