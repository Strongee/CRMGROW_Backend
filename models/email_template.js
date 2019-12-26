const mongoose = require('mongoose');

const EmailTemplate = mongoose.model('email_template',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    subject: String,
    content: String,
    role: String,
    type: String,
    default: {type: Boolean, default: false},
    category: String,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = EmailTemplate