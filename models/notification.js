const mongoose = require('mongoose');

const Notification = mongoose.model('notification', {
    name: String,
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    role: String,
    content: String,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Notification