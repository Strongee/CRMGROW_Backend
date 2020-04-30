const mongoose = require('mongoose');

const PDFTracker = mongoose.model('pdf_tracker',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    pdf: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pdf' }],
    activity: [{ type: mongoose.Schema.Types.ObjectId, ref: 'activity' }],
    type: String,
    duration: Number,
    created_at: Date,
    updated_at: Date,
 });

 module.exports = PDFTracker