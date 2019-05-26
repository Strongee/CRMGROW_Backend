  if(process.env.NODE_ENV === 'production') {
    urls = {
      DOMAIN_URL: 'https://teamgrow.co/',
      API_URL: 'https://teamgrow.co/api/',
      OUTLOOK_AUTHORIZE_URL: 'https://teamgrow.co/profile/outlook',
      GMAIL_AUTHORIZE_URL: 'https://teamgrow.co/profile/gmail',
      VIDEO_THUMBNAIL_URL:  'https://teamgrow.co/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'https://teamgrow.co/api/pdf/preview/',
      FILE_URL: 'https://teamgrow.co/api/file/',
      MATERIAL_VIEW_VIDEO_URL: 'https://teamgrow.co/material/view/video/',
      MATERIAL_VIEW_PDF_URL: 'https://teamgrow.co/material/view/pdf/',
      CONTACT_PAGE_URL: 'https://teamgrow.co/contacts/',
      SMS_RECEIVE_URL: 'https://teamgrow.co/api/sms/receive/',
      AVATAR_URL: 'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
    }
  } else {
    urls = {
      DOMAIN_URL: 'http://localhost:4200/',
      API_URL: 'http://localhost:3000/api/',
      OUTLOOK_AUTHORIZE_URL: 'http://localhost:4200/profile/outlook',
      GMAIL_AUTHORIZE_URL: 'http://localhost:4200/profile/gmail',
      VIDEO_THUMBNAIL_URL: 'http://localhost:3000/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'http://localhost:3000/api/pdf/preview/',
      FILE_URL: 'http://localhost:3000/api/file/',
      MATERIAL_VIEW_VIDEO_URL: 'http://localhost:4200/material/view/video/',
      MATERIAL_VIEW_PDF_URL: 'http://localhost:4200/material/view/pdf/',
      CONTACT_PAGE_URL: 'http://localhost:4200/contacts/',
      SMS_RECEIVE_URL: 'https://teamgrow.co/api/sms/receive/',
      AVATAR_URL: 'https://marketing-image-production.s3.amazonaws.com/uploads/cdf34fec41e40d4000fcf649d42a6666957666fba97ba03fa77eed3365e757943285d8cb65df1e79749c088f114af817384e9ff251957e17162e6e223379f3e2.png',
    }
  }

module.exports = urls
