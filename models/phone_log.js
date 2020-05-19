const mongoose = require('mongoose');

const PhoneLog = mongoose.model('phone_log',
    {
        user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
        content: String,
        type: Number,
        contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
        updated_at: Date,
        created_at: Date,
    },
    { 
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
    }
);

 module.exports = PhoneLog
