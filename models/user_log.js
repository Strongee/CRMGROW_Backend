const mongoose = require('mongoose');

const UserLog = mongoose.model('user_log',{
     user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
     created_at: Date,
     updated_at: Date,
 });
    
 module.exports = UserLog