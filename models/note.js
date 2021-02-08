const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const NoteSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

NoteSchema.index({ user: 1 });
NoteSchema.index({ contacts: 1 });
const Note = mongoose.model('note', NoteSchema);

module.exports = Note;
