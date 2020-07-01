const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const GuestSchema = new Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    name: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    pending: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    editable_members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    shared_videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    shared_pdfs: [{ types: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    shared_images: [{ types: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    shared_contacts: [
      { types: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    ],
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Guest = mongoose.model('guest', GuestSchema);

module.exports = Guest;
