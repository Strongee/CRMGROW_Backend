const mongoose = require('mongoose');

const Contact = mongoose.model('contact',{
     first_name: String,
     last_name: String,
     email:String,
     user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
     address: String,
     city: String,
     state: String,
     zip: String,
     cell_phone: String,
     brokerage: String,
     tag: Array,
     recruiting_stage: String,
     created_at: Date,
     updated_at: Date,
 });

 module.exports = Contact