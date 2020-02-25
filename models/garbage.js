const mongoose = require('mongoose');

const Garbage = mongoose.model('garbage',{
    canned_message: {
      sms:  { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
      email: { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
    },
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Garbage