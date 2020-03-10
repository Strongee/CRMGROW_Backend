const mongoose = require('mongoose');

const Garbage = mongoose.model('garbage',{
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    canned_message: {
      sms:  { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
      email: { type: mongoose.Schema.Types.ObjectId, ref: 'email_template' },
    },
    edited_video: [{type: mongoose.Schema.Types.ObjectId, ref: 'video'}],
    edited_pdf: [{type: mongoose.Schema.Types.ObjectId, ref: 'pdf'}],
    edited_image: [{type: mongoose.Schema.Types.ObjectId, ref: 'image'}],
    desktop_notification: {
      material: {type: Boolean, default: false},
      email: {type: Boolean, default: false},
      follow_up: {type: Boolean, default: false},
      lead_capture: {type: Boolean, default: false},
    },
    email_notification: {
      material: {type: Boolean, default: true},
      email: {type: Boolean, default: true},
      follow_up: {type: Boolean, default: true},
      lead_capture: {type: Boolean, default: false},
    },
    text_notification: {
      material: {type: Boolean, default: true},
      email: {type: Boolean, default: true},
      follow_up: {type: Boolean, default: false},
      lead_capture: {type: Boolean, default: false},
    },
    reminder_before: {type: Number, default: 30},
    capture_dialog: {type: Boolean, default: false},
    created_at: Date,
    updated_at: Date,
 });

 module.exports = Garbage