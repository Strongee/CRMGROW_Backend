const mongoose = require('mongoose');

const Activity = mongoose.model('activity',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    type: String,
    appointments:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'appointment' }],
    follow_ups:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'follow_up' }],
    notes:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'note' }],
    phone_logs:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'phone_log' }],
    videos:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'video' }],
    pdf: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    video_trackers:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'video_tracker' }],
    email: [{ type: mongoose.Schema.Types.ObjectId, ref: 'email' }],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Activity