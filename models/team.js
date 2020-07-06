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
    pdfs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    automations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'automation' }],
    email_templates: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
    ],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    created_at: Date,
    updated_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const Team = mongoose.model('team', TeamSchema);

module.exports = Team;
