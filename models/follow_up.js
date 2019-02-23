const mongoose = require('mongoose');
const user = require('./user')

const FollowUp = mongoose.model('follow_up',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    due_date: Date,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    status: String,
    updated_at: Date,
    created_at: Date,

 });

 module.exports = FollowUp
