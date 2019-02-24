const mongoose = require('mongoose');

const Note = mongoose.model('note',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    updated_at: Date,
    created_at: Date,

 });

 module.exports = Note
