const mongoose = require('mongoose');

const User = mongoose.model('user',{
     user_name: String,
     email:String,
     password: String,
     cell_phone: String,
     time_zone: String,
     email_signature: String,
     notification: Number,
     picture_profile: String,
     created_at: Date,
     updated_at: Date,
 });

 module.exports = User
