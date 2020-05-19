const mongoose = require('mongoose');

const EmailTracker = mongoose.model('email_tracker',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    email: { type: mongoose.Schema.Types.ObjectId, ref: 'email' },
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
    type: {type: String, default: 'open'},
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

 module.exports = EmailTracker