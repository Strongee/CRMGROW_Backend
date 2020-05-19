const mongoose = require('mongoose');

const Image = mongoose.model('image',{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    description: String,
    preview: String,
    type: String,
    url: Array,
    role: String,
    del: { type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

 module.exports = Image