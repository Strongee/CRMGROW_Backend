let domain = 'https://app.crmgrow.com';
const domain1 = 'https://app.crmgrow.com';
let front =
  'http://teamgrow-staticsite-green.s3-website-us-west-1.amazonaws.com';
if (process.env.NODE_ENV === 'production') {
  domain = 'https://app.crmgrow.com';
  front = 'https://app.crmgrow.com';
} else if (process.env.NODE_ENV === 'staging') {
  domain = 'http://3.139.190.87:3000';
  front = 'http://teamgrow-staticsite-green.s3-website-us-west-1.amazonaws.com';
} else {
  domain = 'http://localhost:3000';
  front = 'http://localhost:4201';
}

const urls = {
  DOMAIN_URL: `${domain}/`,
  API_URL: `${domain}/api/`,
  LOGIN_URL: `${domain}/login`,
  PROFILE_URL: `${domain}/profile/`,
  SOCIAL_SIGNUP_URL: `${domain}/signup/`,
  APP_SIGNIN_URL: `${domain}/social-oauth-callback/`,
  OUTLOOK_AUTHORIZE_URL: `${domain}/profile/outlook`,
  GMAIL_AUTHORIZE_URL: `${domain1}/profile/gmail`,
  ZOOM_AUTHORIZE_URL: `${front}/profile/zoom`,
  GOOGLE_CALENDAR_AUTHORIZE_URL: `${domain1}/calendar/google`,
  OUTLOOK_CALENDAR_AUTHORIZE_URL: `${domain1}/calendar/outlook`,
  VIDEO_THUMBNAIL_URL: `${domain}/api/video/thumbnail/`,
  PDF_PREVIEW_URL: `${domain}/api/pdf/preview/`,
  IMAGE_PREVIEW_URL: `${domain}/api/image/preview/`,
  FILE_URL: `${domain}/api/file/`,
  VIDEO_URL: `${domain}/api/video/pipe/`,
  MATERIAL_VIEW_VIDEO_URL: `${domain}/video1/`,
  MATERIAL_USER_VIEW_VIDEO_URL: `${domain}/video`,
  MATERIAL_VIEW_PAGE: `${domain}/material`,
  MATERIAL_VIEW_PDF_URL: `${domain}/pdf1/`,
  MATERIAL_VIEW_IMAGE_URL: `${domain}/image/`,
  CONTACT_PAGE_URL: `${front}/contacts/`,
  FOLLOWUP_PAGE_URL: `${domain}/follow-up/`,
  ASSETS_URL: `${domain}/assets/`,
  ACCEPT_INVITATION_URL: `${domain}/api/appointment/accept?`,
  DECLINE_INVITATION_URL: `${domain}/api/appointment/decline?`,
  SMS_RECEIVE_URL: `${domain}/api/sms/receive-twilio/`,
  SMS_RECEIVE_URL1: `${domain}/api/sms/receive-signalwire/`,
  RESET_PASSWORD_URL: `${domain}/reset-password/`,
  AVATAR_URL:
    'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
  CONTACT_CSV_URL:
    'https://teamgrow.s3.us-east-2.amazonaws.com/contacts_to_load_for_Exp.csv',
  IMPORT_CSV_URL: `${domain}/contacts/import-csv`,
  INTRO_VIDEO_URL:
    'https://zoom.us/rec/play/w2x1LGD1yGDUMkTo3Aa8XA2OAmb7hez5p9raoL7H-lrbLXP-5H52YE_t4MdpJO1y5mTJuZfplpHXjefN.yUHzRToASLwY8yPz?continueMode=true&_x_zm_rtaid=kNtWtmh8Ri2ht1dmHmtPQw.1614790967245.588ab25e5935f7ac744e189c6b379dd3&_x_zm_rhtaid=625',
  // INTRO_VIDEO_URL: `${domain}/video?video=5eeb3e0c702a0f3536f5501a&user=5e9a02eaefb6b2a3449245dc`,
  GOOGLE_CALENDAR_URL: 'https://calendar.google.com/calendar/r/eventedit?',
  TRACK_URL: `${domain}/api/email/opened/`,
  UNSUBSCRIPTION_URL: 'https://email.crmgrow.com/unsubscribe',
  RESUBSCRIPTION_URL: 'https://email.crmgrow.com/resubscribe/',
  CLICK_REDIRECT_URL: 'https://email.crmgrow.com/redirect',
  LOGO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/image.png',
  DEFAULT_TEMPLATE_PAGE_LOGO: `${domain}/theme/images/default_logo.png`,
  STORAGE_BASE: 'https://teamgrow.s3.us-east-2.amazonaws.com',
  TEAM_URL: `${domain}/team/`,
  TEAM_ACCEPT_URL: `${domain}/team/accept/`,
  TEAM_ACCEPT_REQUEST_URL: `${domain}/team/accept-request`,
  TEAM_CALLS: `${domain}/team/calls/`,
  BILLING_URL: `${domain}/profile/billing`,
  FACEBOOK_URL: 'https://www.facebook.com/crmgrow',
  TERMS_SERVICE_URL: 'https://crmgrow.com/terms_of_service.html',
  PRIVACY_URL: 'https://crmgrow.com/privacy.html',
  UNSUSCRIPTION_URL: `${domain}`,
  RECORDING_PREVIEW_URL:
    'https://teamgrow.s3.us-east-2.amazonaws.com/gif120/9/5f7fd210b5c62a75b11e130b',
  ONEONONE_URL: 'https://crmgrow.com/oneonone',
};

module.exports = urls;
