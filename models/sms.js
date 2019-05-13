const mongoose = require('mongoose');

const SMS = mongoose.model('sms',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    text: String,
    from: String,
    updated_at: Date,
    created_at: Date,
 });

 module.exports = SMS
