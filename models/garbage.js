const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const GarbageSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    canned_message: {
      sms: { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
      email: { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
    },
    edited_video: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    edited_pdf: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    edited_image: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    edited_automation: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'automation' },
    ],
    desktop_notification: {
      material: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      follow_up: { type: Boolean, default: false },
      lead_capture: { type: Boolean, default: false },
      unsubscription: { type: Boolean, default: false },
      resubscription: { type: Boolean, default: false },
    },
    email_notification: {
      material: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      follow_up: { type: Boolean, default: true },
      lead_capture: { type: Boolean, default: false },
      unsubscription: { type: Boolean, default: true },
      resubscription: { type: Boolean, default: true },
    },
    text_notification: {
      material: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      follow_up: { type: Boolean, default: false },
      lead_capture: { type: Boolean, default: false },
      unsubscription: { type: Boolean, default: false },
      resubscription: { type: Boolean, default: false },
    },
    reminder_before: { type: Number, default: 30 },
    capture_dialog: { type: Boolean, default: false },
    capture_delay: { type: Number, default: 0 },
    capture_videos: { type: Array, default: [] },
    capture_field: {
      email: { type: Boolean, default: true },
      cell_phone: { type: Boolean, default: true },
      first_name: { type: Boolean, default: true },
    },
    index_page: { type: mongoose.Schema.Types.ObjectId, ref: 'page' },
    logo: { type: String },
    material_theme: { type: String, default: 'theme2' },
    auto_follow_up: {
      enabled: { type: Boolean, default: false },
      period: Number,
      content: String,
    },
    highlights: { type: Array, default: [] },
    brands: { type: Array, default: [] },
    intro_video: { type: String },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Garbage = mongoose.model('garbage', GarbageSchema);

module.exports = Garbage;
