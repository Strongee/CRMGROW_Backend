const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const SMS = mongoose.model('sms', {
=======
const SMSSchema = new Schema({
>>>>>>> master
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
  phone: String,
  content: String,
  from: String,
  updated_at: Date,
  created_at: Date,
<<<<<<< HEAD
});
=======
},
{ 
 timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const SMS = mongoose.model('sms', SMSSchema);
>>>>>>> master

module.exports = SMS;
