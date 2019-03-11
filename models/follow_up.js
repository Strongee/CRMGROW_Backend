const mongoose = require('mongoose');

const FollowUp = mongoose.model('follow_up',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    due_date: Date,
    content: String,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    status: [{ type: Number, default: 0}],
    updated_at: Date,
    created_at: Date,
 });

 module.exports = FollowUp
