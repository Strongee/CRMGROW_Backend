const mongoose = require('mongoose');

const PDF = mongoose.model('pdf',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    title: String,
    description: String,
    preview: String,
    type: String,
    url: String,
    role: String,
    duration: Number,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = PDF