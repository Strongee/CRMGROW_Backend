const mongoose = require('mongoose');

const Video = mongoose.model('video',{
    name: String,
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    video: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    time_start: Date,
    duration: Number,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Video