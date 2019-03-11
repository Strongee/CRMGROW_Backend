const mongoose = require('mongoose');

const Activity = mongoose.model('activity',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    type: String,
    notes:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'note' }],
    phone_logs:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'phone_log' }],
    email: [{ type: mongoose.Schema.Types.ObjectId, ref: 'email' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Activity