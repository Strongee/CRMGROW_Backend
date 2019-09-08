  if(process.env.NODE_ENV === 'production') {
    urls = {
      DOMAIN_URL: 'https://app.crmgrow.com/',
      API_URL: 'https://app.crmgrow.com/api/',
      LOGIN_URL: 'https://app.crmgrow.com/login',
      PROFILE_URL: 'https://app.crmgrow.com/profile/',
      OUTLOOK_AUTHORIZE_URL: 'https://app.crmgrow.com/profile/outlook',
      GMAIL_AUTHORIZE_URL: 'https://app.crmgrow.com/profile/gmail',
      VIDEO_THUMBNAIL_URL:  'https://app.crmgrow.com/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'https://app.crmgrow.com/api/pdf/preview/',
      FILE_URL: 'https://app.crmgrow.com/api/file/',
      VIDEO_URL: 'https://app.crmgrow.com/api/video/pipe/',
      MATERIAL_VIEW_VIDEO_URL: 'https://app.crmgrow.com/video',
      MATERIAL_VIEW_PDF_URL: 'https://app.crmgrow.com/material/view/pdf/',
      CONTACT_PAGE_URL: 'https://app.crmgrow.com/contacts/',
      FOLLOWUP_PAGE_URL: 'https://app.crmgrow.com/follow-up/',
      ASSETS_URL: 'https://app.crmgrow.com/assets/',
      ACCEPT_INVITATION_URL: 'https://app.crmgrow.com/api/appointment/accept?',
      DECLINE_INVITATION_URL: 'https://app.crmgrow.com/api/appointment/decline?',
      SMS_RECEIVE_URL: 'https://app.crmgrow.com/api/sms/receive/',
      RESET_PASSWORD_URL: 'https://app.crmgrow.com/reset-password/',
      AVATAR_URL: 'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
      CONTACT_CSV_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/crmgrow-sample-contact-upload.csv',
      INTRO_VIDEO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/how+to+send+video+-+crmgrow.mp4',
      GOOGLE_CALENDAR_URL: 'https://calendar.google.com/calendar/r/eventedit?'
    }
  } else {
    urls = {
      DOMAIN_URL: 'http://localhost:4200/',
      API_URL: 'http://localhost:3000/api/',
      LOGIN_URL: 'http://localhost:3000/login',
      PROFILE_URL: 'http://localhost:3000/profile/',
      OUTLOOK_AUTHORIZE_URL: 'http://localhost:4200/profile/outlook',
      GMAIL_AUTHORIZE_URL: 'http://localhost:4200/profile/gmail',
      VIDEO_THUMBNAIL_URL: 'http://localhost:3000/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'http://localhost:3000/api/pdf/preview/',
      FILE_URL: 'http://localhost:3000/api/file/',
      VIDEO_URL: 'http://localhost:3000/api/video/pipe/',
      MATERIAL_VIEW_VIDEO_URL: 'http://localhost:4200/video/',
      MATERIAL_VIEW_PDF_URL: 'http://localhost:4200/material/view/pdf/',
      CONTACT_PAGE_URL: 'https://app.crmgrow.com/contacts/',
      FOLLOWUP_PAGE_URL: 'https://app.crmgrow.com/follow-up/',
      ASSETS_URL: 'http://localhost:3000/assets/',
      ACCEPT_INVITATION_URL: 'http://localhost:3000/api/appointment/accept?',
      DECLINE_INVITATION_URL: 'http://localhost:3000/api/appointment/decline?',
      SMS_RECEIVE_URL: 'https://app.crmgrow.com/api/sms/receive/',
      RESET_PASSWORD_URL: 'http://localhost:4200/reset-password/',
      AVATAR_URL: 'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
      CONTACT_CSV_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/crmgrow-sample-contact-upload.csv',
      INTRO_VIDEO_URL: 'https://teamgrow.s3.us-east-2.amazonaws.com/how+to+send+video+-+crmgrow.mp4',
      GOOGLE_CALENDAR_URL: 'https://calendar.google.com/calendar/r/eventedit?'
    }
  }

module.exports = urls
