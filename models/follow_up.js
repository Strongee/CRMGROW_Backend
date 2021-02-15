const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const FollowUpSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    due_date: Date,
    content: { type: String, default: 'Contact has reviewed material' },
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    status: { type: Number, default: 0 },
    reminder: Number,
    reminder_type: String,
    type: String,
    set_recurrence: Boolean,
    recurrence_mode: Date,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const FollowUp = mongoose.model('follow_up', FollowUpSchema);

module.exports = FollowUp;
