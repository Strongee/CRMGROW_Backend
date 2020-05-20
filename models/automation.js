const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AutomationSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    title: String,
    automations: Array,
    del: { type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 },{ 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
})

const Automation = mongoose.model('automation', AutomationSchema);

 module.exports = Automation