const mongoose = require('mongoose');

const Automation = mongoose.model('automation',{
    title: String,
    trigger: String,
    event: String,
    delay: Number,
    type: String,
    del: { type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Automation