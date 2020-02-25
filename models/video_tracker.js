const mongoose = require('mongoose');

const VideoTracker = mongoose.model('video_tracker',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'video' },
    activity: [{ type: mongoose.Schema.Types.ObjectId, ref: 'activity' }],
    duration: Number,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = VideoTracker