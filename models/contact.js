const mongoose = require('mongoose');

const Contact = mongoose.model('contact',{
     first_name: String,
     last_name: {type: String, default: ''},
     email: {type: String, default: ''},
     user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
     last_activity: { type: mongoose.Schema.Types.ObjectId, ref: 'activity' },   
     address: String,
     city: String,
     state: String,
     zip: String,
     label: String,
     cell_phone: {type: String, default: ''},
     country: {type: String, default: ''},
     brokerage: String,
     tag: Array,
     recruiting_stage: String,
     created_at: Date,
     updated_at: Date,
 });

 module.exports = Contact