const mongoose = require('mongoose');

const Email = mongoose.model('email',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    status: { type: Number, default: 0},
    subject: String,
    content: String,
    to: Array,
    cc: Array,
    bcc: Array,
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' }, 
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Email