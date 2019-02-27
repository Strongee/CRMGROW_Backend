const mongoose = require('mongoose');

const Appointment = mongoose.model('appointment',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    title: String,
    description: String,
    location: String,
    due_start: Date,
    due_end: String,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Appointment