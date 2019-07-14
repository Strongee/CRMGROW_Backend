const mongoose = require('mongoose');

const User = mongoose.model('user',{
     user_name: String,
     social_id: String,
     email: String,
     hash: String,
     salt: String,
     cell_phone: String,
     time_zone: {type: String, default: "-07:00"},
     email_signature: {type: String, default: ""},
     twilio_proxy_number: String,
     picture_profile: String,
     role: String,
     outlook_refresh_token: String,
     google_refresh_token: String,
     connected_email_type: String,
     connect_calendar: { type: Boolean, default: false},
     connected_email: String,
     daily_report: { type: Boolean, default: false},
     weekly_report: { type: Boolean, default: false},
     desktop_notification: { type: Boolean, default: false},
     desktop_notification_subscription: String,
     is_trial: { type: Boolean, default: true},
     expired_at: Date,
     created_at: Date,
     updated_at: Date,
 });

 module.exports = User
