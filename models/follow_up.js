const mongoose = require('mongoose');

const FollowUp = mongoose.model('follow_up',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    due_date: Date,
    content: { type: String, default: ""},
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    status: { type: Number, default: 0},
    reminder: Number,
    reminder_type: String,
    type: String,
    updated_at: Date,
    created_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

 module.exports = FollowUp
