const mongoose = require('mongoose');

const TimeLine = mongoose.model('time_line',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    status: String,
    due_date: Date,
    period: Number,
    action: Object,
    ref: Number,
    parent_ref: Number,
    automation: { type: mongoose.Schema.Types.ObjectId, ref: 'automation' },
    condition: {
        case: String,
        answer: Boolean
    },
    created_at: Date,
    updated_at: Date,
 });

 module.exports = TimeLine