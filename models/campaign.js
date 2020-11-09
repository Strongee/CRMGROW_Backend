const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CampaignSchema = new Schema(
  {
    title: String,
    contacts: Array,
    mail_list: { type: mongoose.Schema.Types.ObjectId, ref: 'mail_list' },
    email_template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'email_template',
    },
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('campaign', CampaignSchema);
