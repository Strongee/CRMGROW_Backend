const mongoose = require('mongoose');

const Email = mongoose.model('email',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    subject: String,
    content: String,
    to: String,
    cc: String,
    bcc: Array,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }], 
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Email