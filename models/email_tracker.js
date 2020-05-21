const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const EmailTracker = mongoose.model('email_tracker', {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
  email: { type: mongoose.Schema.Types.ObjectId, ref: 'email' },
  activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
  type: String,
  created_at: Date,
  updated_at: Date,
});
=======
const TrackerSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    email: { type: mongoose.Schema.Types.ObjectId, ref: 'email' },
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },
    type: {type: String, default: 'open'},
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const EmailTracker = mongoose.model('email_tracker', TrackerSchema);
>>>>>>> master

module.exports = EmailTracker;
