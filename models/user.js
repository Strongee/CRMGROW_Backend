const mongoose = require('mongoose');

const User = mongoose.model('user',{
     user_name: String,
     email: String,
     hash: String,
     salt: String,
     cell_phone: String,
     time_zone: String,
     email_signature: String,
     notification: Number,
     picture_profile: String,
     role: String,
     outlook_token: String,
     created_at: Date,
     updated_at: Date,
 });

 module.exports = User
