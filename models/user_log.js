const mongoose = require('mongoose');

const UserLog = mongoose.model('user_log',{
     user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
     created_at: Date,
     updated_at: Date,
 },
 { 
   timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
 });
    
 module.exports = UserLog