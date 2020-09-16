const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const system_settings = require('../config/system_settings');

const UserSchema = new Schema(
  {
    user_name: String,
    nick_name: String,
    social_id: String,
    email: String,
    hash: String,
    salt: String,
    cell_phone: String,
    phone: {
      number: String,
      internationalNumber: String,
      nationalNumber: String,
      countryCode: String,
      areaCode: String,
      dialCode: String,
    },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'payment' },
    time_zone_info: String,
    time_zone: { type: String, default: '-07:00' },
    email_signature: { type: String, default: '' },
    proxy_number: String,
    proxy_number_id: String,
    twilio_number: String,
    proxy_phone: {
      number: String,
      is_released: { type: Boolean, default: false },
      updated_at: Date,
    },
    picture_profile: String,
    learn_more: String,
    role: String,
    primary_connected: { type: Boolean, default: false },
    outlook_refresh_token: String,
    google_refresh_token: String,
    yahoo_refresh_token: String,
    other_emailer: Object,
    connected_email_type: String,
    connect_calendar: { type: Boolean, default: false },
    connected_email: String,
    daily_report: { type: Boolean, default: false },
    weekly_report: { type: Boolean, default: true },
    admin_notification: { type: Number, default: 0 },
    desktop_notification: { type: Boolean, default: false },
    desktop_notification_subscription: String,
    text_notification: { type: Boolean, default: false },
    contact_info: {
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.CONTACT_UPLOAD_LIMIT.BASIC,
      },
    },
    text_info: {
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.TEXT_MONTHLY_LIMIT.BASIC,
      },
      count: { type: Number, default: 0 },
    },
    email_info: {
      is_limit: { type: Boolean, default: true },
      max_count: {
        type: Number,
        default: system_settings.EMAIL_DAILY_LIMIT.BASIC,
      },
      count: { type: Number, default: 0 },
    },
    welcome_email: { type: Boolean, default: false },
    is_trial: { type: Boolean, default: true },
    is_free: { type: Boolean, default: false },
    subscription: {
      is_failed: { type: Boolean, default: false },
      updated_at: Date,
      is_suspended: { type: Boolean, default: false },
      suspended_at: Date,
      attempt_count: { type: Number, default: 0 },
      period: { type: String, default: 'month' },
    },
    expired_at: Date,
    created_at: Date,
    updated_at: Date,
    last_logged: Date,
    del: { type: Boolean, default: false },
    admin_loggin: { type: Boolean, default: false },
    guest_loggin: { type: Boolean, default: false },
    sub_domain: String,
    social_link: {
      facebook: String,
      twitter: String,
      linkedin: String,
    },
    company: { type: String, default: system_settings.COMPANY.DEFAULT },
    affiliate: {
      id: String,
      link: String,
      paypal: String,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

const User = mongoose.model('user', UserSchema);

module.exports = User;
