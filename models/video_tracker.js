const mongoose = require('mongoose');

const VideoTracker = mongoose.model('video_tracker',
    {
        user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
        contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
        video: { type: mongoose.Schema.Types.ObjectId, ref: 'video' },
        activity: [{ type: mongoose.Schema.Types.ObjectId, ref: 'activity' }],
        type: {type: String, default: 'watch'},
        duration: Number,
        created_at: Date,
        updated_at: Date,
     }, 
     { 
         timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
     });

 module.exports = VideoTracker