const mongoose = require('mongoose');

const ImageTracker = mongoose.model('image_tracker',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    ImageTracker: [{ type: mongoose.Schema.Types.ObjectId, ref: 'image' }],
    activity: [{ type: mongoose.Schema.Types.ObjectId, ref: 'activity' }],
    duration: Number,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = ImageTracker