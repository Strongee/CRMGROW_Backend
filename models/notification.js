const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const Notification = mongoose.model('notification', {
  name: String,
  type: String,
  del: { type: Boolean, default: false },
  sent: { type: Boolean, default: false },
  criteria: String,
  content: String,
  created_at: Date,
  updated_at: Date,
});
=======
const NotificationSchema = new Schema({
    name: String,
    type: String,
    del: {type: Boolean, default: false},
    sent: {type: Boolean, default: false},
    criteria: String,
    content: String,
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Notification = mongoose.model('notification', NotificationSchema);
>>>>>>> master

module.exports = Notification;
