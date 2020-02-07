const mongoose = require('mongoose');

const TimeLine = mongoose.model('time_line',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    automation: {type: mongoose.Schema.Types.ObjectId, ref: 'automation'},
    status: String,
    due_date: Date,
    delay: Number,
    action: Object,
    id: Number,
    parent_id: Number,
    condition: {
        type: String,
        answer: Boolean
    },
    created_at: Date,
    updated_at: Date,
 });

 module.exports = TimeLine