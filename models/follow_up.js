const mongoose = require('mongoose');

const FollowUp = mongoose.model('follow_up',{
    user: mongoose.Schema.ObjectId, ref: 'user',
    due_date: Date,
    contact: mongoose.Schema.ObjectId, ref: 'contact',
    status: String,
    updated_at: Date,
    created_at: Date,

 });

 module.exports = FollowUp
