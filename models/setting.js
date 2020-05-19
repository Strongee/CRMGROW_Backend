const mongoose = require('mongoose');

const Setting = mongoose.model('setting',{
    contact_limits: {type: Number, default: 3000},
    updated_at: Date,
    created_at: Date,
 },
 { 
   timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
 });

 module.exports = Setting
