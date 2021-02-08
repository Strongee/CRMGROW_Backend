const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const EmailSchema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    event: String,
    subject: String,
    content: String,
    type: String,
    to: Array,
    cc: Array,
    bcc: Array,
    message_id: String,
    contacts: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

EmailSchema.index({ message_id: 1 });
const Email = mongoose.model('email', EmailSchema);

module.exports = Email;
