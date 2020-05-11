const mongoose = require('mongoose');

const Video = mongoose.model('video',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    company: {type: String},
    description: String,
    converted: { type: Boolean, default: false},
    thumbnail: String,
    thumbnail_path: String,
    custom_thumbnail: { type: Boolean, default: false},
    preview: String,
    recording: {type: Boolean, default: false},
    path: String,
    type: String,
    duration: Number,
    url: String,
    role: String,
    default_edited: {type: Boolean, default: false},
    priority: { type: Number, default: 1000},
    del: { type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Video