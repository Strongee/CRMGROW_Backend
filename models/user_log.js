const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const UserLog = mongoose.model('user_log', {
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  created_at: Date,
  updated_at: Date,
});

module.exports = UserLog;
=======
const UserSchema = new Schema({
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  created_at: Date,
  updated_at: Date,
},
{ 
timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const UserLog = mongoose.model('user_log', UserSchema);
    
 module.exports = UserLog
>>>>>>> master
