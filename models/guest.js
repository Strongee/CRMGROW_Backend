const mongoose = require('mongoose');

const Guest = mongoose.model('guest',{
     user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
     email: String,
     hash: String,
     salt: String,
     disabled: {type: Boolean, default: false},
     last_logged: Date,
     created_at: Date,
     updated_at: Date,
 });

 module.exports = Guest