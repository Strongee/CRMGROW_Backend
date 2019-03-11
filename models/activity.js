const mongoose = require('mongoose');

const Activity = mongoose.model('activity',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    type: String,
    follow_ups:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'follow_up' }],
    notes:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'note' }],
    phone_logs:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'phone_log' }],
    email: [{ type: mongoose.Schema.Types.ObjectId, ref: 'email' }],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Activity