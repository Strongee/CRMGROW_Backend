const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const Note = mongoose.model('note', {
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  content: String,
  contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
  updated_at: Date,
  created_at: Date,
});
=======
const NoteSchema = new Schema({
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    updated_at: Date,
    created_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Note = mongoose.model('note', NoteSchema);
>>>>>>> master

module.exports = Note;
