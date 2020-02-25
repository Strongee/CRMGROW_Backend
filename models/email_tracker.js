const mongoose = require('mongoose');

const EmailTracker = mongoose.model('email_tracker',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    email: { type: mongoose.Schema.Types.ObjectId, ref: 'email' },
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
    type: String,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = EmailTracker