const mongoose = require('mongoose');

const Video = mongoose.model('video',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    title: String,
    description: String,
    thumbnail: String,
    type: String,
    duration: Number,
    url: String,
    role: String,
    del: { type: Boolean, default: true},
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Video