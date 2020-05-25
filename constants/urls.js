let urls;
if (process.env.NODE_ENV === 'production') {
  urls = {
    DOMAIN_URL: 'https://app.crmgrow.com/',
    API_URL: 'https://app.crmgrow.com/api/',
    LOGIN_URL: 'https://app.crmgrow.com/login',
    PROFILE_URL: 'https://app.crmgrow.com/profile/',
    SOCIAL_SIGNUP_URL: 'https://app.crmgrow.com/signup/',
    OUTLOOK_AUTHORIZE_URL: 'https://app.crmgrow.com/profile/outlook',
    GMAIL_AUTHORIZE_URL: 'https://app.crmgrow.com/profile/gmail',
    VIDEO_THUMBNAIL_URL: 'https://app.crmgrow.com/api/video/thumbnail/',
    PDF_PREVIEW_URL: 'https://app.crmgrow.com/api/pdf/preview/',
    IMAGE_PREVIEW_URL: 'https://app.crmgrow.com/api/image/preview/',
    FILE_URL: 'https://app.crmgrow.com/api/file/',
    VIDEO_URL: 'https://app.crmgrow.com/api/video/pipe/',
    MATERIAL_VIEW_VIDEO_URL: 'https://app.crmgrow.com/video1/',
    MATERIAL_VIEW_PAGE: 'https://app.crmgrow.com/material',
    MATERIAL_VIEW_PDF_URL: 'https://app.crmgrow.com/pdf1/',
    MATERIAL_VIEW_IMAGE_URL: 'https://app.crmgrow.com/image/',
    CONTACT_PAGE_URL: 'https://app.crmgrow.com/contacts/',
    FOLLOWUP_PAGE_URL: 'https://app.crmgrow.com/follow-up/',
    ASSETS_URL: 'https://app.crmgrow.com/assets/',
    ACCEPT_INVITATION_URL: 'https://app.crmgrow.com/api/appointment/accept?',
    DECLINE_INVITATION_URL: 'https://app.crmgrow.com/api/appointment/decline?',
    SMS_RECEIVE_URL: 'https://app.crmgrow.com/api/sms/receive/',
    RESET_PASSWORD_URL: 'https://app.crmgrow.com/reset-password/',
    AVATAR_URL:
      'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
    CONTACT_CSV_URL:
      'https://teamgrow.s3.us-east-2.amazonaws.com/contacts_to_load_for_Exp.csv',
    // INTRO_VIDEO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/how+to+send+video+-+crmgrow.mp4',
    INTRO_VIDEO_URL:
      'https://www.loom.com/share/7ac336c756d14f48990b61c06f18dadf',
    GOOGLE_CALENDAR_URL: 'https://calendar.google.com/calendar/r/eventedit?',
    TRACK_URL: 'https://app.crmgrow.com/api/email/opened/',
    UNSUBSCRIPTION_URL: 'https://email.crmgrow.com/unsubscribe/',
    RESUBSCRIPTION_URL: 'https://email.crmgrow.com/resubscribe/',
    LOGO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/image.png',
    DEFAULT_TEMPLATE_PAGE_LOGO:
      'https://app.crmgrow.com/theme/images/default_logo.png',
  };
} else if (process.env.NODE_ENV === 'staging') {
  urls = {
    DOMAIN_URL: 'https://stg.crmgrow.com/',
    API_URL: 'https://stg.crmgrow.com/api/',
    LOGIN_URL: 'https://stg.crmgrow.com/login',
    PROFILE_URL: 'https://stg.crmgrow.com/profile/',
    SOCIAL_SIGNUP_URL: 'https://stg.crmgrow.com/signup/',
    OUTLOOK_AUTHORIZE_URL: 'https://stg.crmgrow.com/profile/outlook',
    GMAIL_AUTHORIZE_URL: 'https://stg.crmgrow.com/profile/gmail',
    VIDEO_THUMBNAIL_URL: 'https://stg.crmgrow.com/api/video/thumbnail/',
    PDF_PREVIEW_URL: 'https://stg.crmgrow.com/api/pdf/preview/',
    IMAGE_PREVIEW_URL: 'https://stg.crmgrow.com/api/image/preview/',
    FILE_URL: 'https://stg.crmgrow.com/api/file/',
    VIDEO_URL: 'https://stg.crmgrow.com/api/video/pipe/',
    MATERIAL_VIEW_VIDEO_URL: 'https://stg.crmgrow.com/video1/',
    MATERIAL_VIEW_PAGE: 'https://stg.crmgrow.com/material',
    MATERIAL_VIEW_PDF_URL: 'https://stg.crmgrow.com/pdf1/',
    MATERIAL_VIEW_IMAGE_URL: 'https://stg.crmgrow.com/image/',
    CONTACT_PAGE_URL: 'https://stg.crmgrow.com/contacts/',
    FOLLOWUP_PAGE_URL: 'https://stg.crmgrow.com/follow-up/',
    ASSETS_URL: 'https://stg.crmgrow.com/assets/',
    ACCEPT_INVITATION_URL: 'https://stg.crmgrow.com/api/appointment/accept?',
    DECLINE_INVITATION_URL: 'https://stg.crmgrow.com/api/appointment/decline?',
    SMS_RECEIVE_URL: 'https://stg.crmgrow.com/api/sms/receive/',
    RESET_PASSWORD_URL: 'https://stg.crmgrow.com/reset-password/',
    AVATAR_URL:
      'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
    CONTACT_CSV_URL:
      'https://teamgrow.s3.us-east-2.amazonaws.com/contacts_to_load_for_Exp.csv',
    INTRO_VIDEO_URL:
      'https://www.loom.com/share/7ac336c756d14f48990b61c06f18dadf',
    GOOGLE_CALENDAR_URL: 'https://calendar.google.com/calendar/r/eventedit?',
    TRACK_URL: 'https://stg.crmgrow.com/api/email/track/',
    EMAIL_OPENED_URL: 'https://stg.crmgrow.com/api/email/opened/',
    UNSUBSCRIPTION_URL: 'https://stg.crmgrow.com/api/email/unsubscribe/',
    RESUBSCRIPTION_URL: 'https://stg.crmgrow.com/api/email/resubscribe/',
    LOGO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/image.png',
    DEFAULT_TEMPLATE_PAGE_LOGO:
      'https://stg.crmgrow.com/theme/images/default_logo.png',
  };
} else {
  urls = {
    DOMAIN_URL: 'https://app.crmgrow.com/',
    API_URL: 'http://localhost:3000/api/',
    LOGIN_URL: 'https://app.crmgrow.com/login',
    PROFILE_URL: 'http://localhost:3000/profile/',
    SOCIAL_SIGNUP_URL: 'http://localhost:4200/signup/',
    OUTLOOK_AUTHORIZE_URL: 'http://localhost:4200/profile/outlook',
    GMAIL_AUTHORIZE_URL: 'http://localhost:4200/profile/gmail',
    VIDEO_THUMBNAIL_URL: 'http://localhost:3000/api/video/thumbnail/',
    PDF_PREVIEW_URL: 'http://localhost:3000/api/pdf/preview/',
    IMAGE_PREVIEW_URL: 'http://localhost:3000/api/image/preview/',
    TRACK_URL: 'http://localhost:3000/api/email/track/',
    FILE_URL: 'http://localhost:3000/api/file/',
    VIDEO_URL: 'http://localhost:3000/api/video/pipe/',
    MATERIAL_VIEW_VIDEO_URL: 'https://app.crmgrow.com/video1/',
    MATERIAL_VIEW_PAGE: 'https://app.crmgrow.com/material',
    MATERIAL_VIEW_PDF_URL: 'http://localhost:3000/pdf1/',
    MATERIAL_VIEW_IMAGE_URL: 'http://localhost:3000/image/',
    CONTACT_PAGE_URL: 'https://app.crmgrow.com/contacts/',
    FOLLOWUP_PAGE_URL: 'https://app.crmgrow.com/follow-up/',
    ASSETS_URL: 'http://localhost:3000/assets/',
    ACCEPT_INVITATION_URL: 'http://localhost:3000/api/appointment/accept?',
    DECLINE_INVITATION_URL: 'http://localhost:3000/api/appointment/decline?',
    SMS_RECEIVE_URL: 'https://app.crmgrow.com/api/sms/receive/',
    RESET_PASSWORD_URL: 'http://localhost:4200/reset-password/',
    AVATAR_URL:
      'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
    CONTACT_CSV_URL:
      'https://teamgrow.s3.us-east-2.amazonaws.com/contacts_to_load_for_Exp.csv',
    INTRO_VIDEO_URL:
      'https://www.loom.com/share/7ac336c756d14f48990b61c06f18dadf',
    GOOGLE_CALENDAR_URL: 'https://calendar.google.com/calendar/r/eventedit?',
    UNSUBSCRIPTION_URL: 'http://localhost:3000/api/email/unsubscribe/',
    RESUBSCRIPTION_URL: 'http://localhost:3000/api/email/resubscribe/',
    LOGO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/image.png',
    DEFAULT_TEMPLATE_PAGE_LOGO:
      'http://localhost:3000/theme/images/default_logo.png',
  };
}

module.exports = urls;
