const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const Email = mongoose.model('email', {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  event: String,
  subject: String,
  content: String,
  to: Array,
  cc: Array,
  bcc: Array,
  message_id: String,
  contacts: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
  created_at: Date,
  updated_at: Date,
});
=======
const EmailSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    event: String,
    subject: String,
    content: String,
    to: Array,
    cc: Array,
    bcc: Array,
    message_id: String,
    contacts: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' }, 
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Email = mongoose.model('email', EmailSchema);
>>>>>>> master

module.exports = Email;
