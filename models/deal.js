const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const DealSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    title: String,
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    deal_stage: { type: mongoose.Schema.Types.ObjectId, ref: 'deal_stage' },
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Deal = mongoose.model('deal', DealSchema);

module.exports = Deal;
