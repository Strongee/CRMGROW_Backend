const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TextSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    phone: String,
    content: String,
    from: String,
    type: Number,
    status: String,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Text = mongoose.model('text', TextSchema);

module.exports = Text;
