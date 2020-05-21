const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const Reminder = mongoose.model('reminder', {
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  due_date: Date,
  type: String,
  del: { type: Boolean, default: false },
=======
const ReminderSchema = new Schema({
  user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  due_date: Date,
  type: String,
  del: { type: Boolean, default: false},
>>>>>>> master
  contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
  appointment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'appointment' }],
  follow_up: [{ type: mongoose.Schema.Types.ObjectId, ref: 'follow_up' }],
  created_at: Date,
  updated_at: Date,
<<<<<<< HEAD
});
=======
},
{ 
 timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Reminder = mongoose.model('reminder', ReminderSchema);
>>>>>>> master

module.exports = Reminder;
