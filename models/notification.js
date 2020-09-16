const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const NotificationSchema = new Schema(
  {
    name: String,
    type: { type: String, default: 'personal' },
    del: { type: Boolean, default: false },
    sent: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    is_read: { type: Boolean, default: false },
    criteria: String,
    followup: { type: mongoose.Schema.Types.ObjectId, ref: 'follow_up' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'team' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    description: String,
    content: String,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);
NotificationSchema.index({ user: 1 });
const Notification = mongoose.model('notification', NotificationSchema);

module.exports = Notification;
