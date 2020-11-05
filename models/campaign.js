const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const MailListSchema = new Schema(
  {
    title: String,
    contacts: Array,
    mail_list: { type: mongoose.Schema.Types.ObjectId, ref: 'mail_list' },
    material_theme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'material_theme',
    },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('mail_list', MailListSchema);
