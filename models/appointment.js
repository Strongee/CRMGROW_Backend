const mongoose = require('mongoose');

const Appointment = mongoose.model('appointment',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    title: String,
    description: String,
    location: String,
    due_start: Date,
    due_end: String,
    type: String,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    guest: Array,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Appointment