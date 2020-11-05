const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MailListSchema = new Schema(
  {
    title: String,
    contacts: Array,
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('mail_list', MailListSchema);
