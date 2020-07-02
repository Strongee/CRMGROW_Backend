const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const TeamSchema = new Schema(
  {
    owner: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    name: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    invites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    editors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    pdfs: [{ types: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    images: [{ types: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    contacts: [{ types: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Team = mongoose.model('team', TeamSchema);

module.exports = Team;
