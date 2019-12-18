const mongoose = require('mongoose');

const Email = mongoose.model('email',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    event: String,
    subject: String,
    content: String,
    to: Array,
    cc: Array,
    bcc: Array,
    message_id: String,
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }], 
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Email