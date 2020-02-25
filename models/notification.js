const mongoose = require('mongoose');

const Notification = mongoose.model('notification', {
    name: String,
    type: String,
    del: {type: Boolean, default: false},
    sent: {type: Boolean, default: false},
    criteria: String,
    content: String,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Notification