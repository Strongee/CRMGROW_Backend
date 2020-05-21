const mongoose = require('mongoose');
const Schema = mongoose.Schema;

<<<<<<< HEAD
const Setting = mongoose.model('setting', {
  contact_limits: { type: Number, default: 3000 },
  updated_at: Date,
  created_at: Date,
});
=======
const SettingSchema = new Schema({
  contact_limits: {type: Number, default: 3000},
  updated_at: Date,
  created_at: Date,
},
{ 
 timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Setting = mongoose.model('setting', SettingSchema);
>>>>>>> master

module.exports = Setting;
