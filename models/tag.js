const mongoose = require('mongoose');

const Tag = mongoose.model('tag',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    updated_at: Date,
    created_at: Date,
 });

 module.exports = Tag
