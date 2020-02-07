const mongoose = require('mongoose');

const Automation = mongoose.model('automation',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    automations: Array,
    trigger: String,
    event: String,
    delay: Number,
    type: String,
    del: { type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Automation