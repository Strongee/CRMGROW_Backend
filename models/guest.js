const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GuestSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    email: String,
    hash: String,
    salt: String,
    disabled: {type: Boolean, default: false},
    last_logged: Date,
    created_at: Date,
    updated_at: Date,
},{ 
   timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Guest = mongoose.model('guest', GuestSchema);

 module.exports = Guest