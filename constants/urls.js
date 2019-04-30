  if(process.env.NODE_ENV === 'production') {
    urls = {
      DOMAIN_URL: 'http://3.14.73.71/',
      API_URL: 'http://3.14.73.71/api/',
      OUTLOOK_AUTHORIZE_URL: 'http://3.14.73.71/profile/outlook/',
      GMAIL_AUTHORIZE_URL: 'http://3.14.73.71/profile/gmail/',
      VIDEO_THUMBNAIL_URL:  'http://3.14.73.71/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'http://3.14.73.71/api/pdf/preview/',
      FILE_URL: 'http://3.14.73.71/api/file/',
      MATERIAL_VIEW_VIDEO_URL: 'http://3.14.73.71/material/view/video/',
      MATERIAL_VIEW_PDF_URL: 'http://3.14.73.71/material/view/pdf/'
    }
  } else {
    urls = {
      DOMAIN_URL: 'http://localhost:4200/',
      API_URL: 'http://localhost:3000/api/',
      OUTLOOK_AUTHORIZE_URL: 'http://localhost:3000/api/user/authorize-outlook',
      GMAIL_AUTHORIZE_URL: 'http://localhost:3000/api/user/authorize-gmail',
      VIDEO_THUMBNAIL_URL: 'http://localhost:3000/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'http://localhost:3000/api/pdf/preview/',
      FILE_URL: 'http://localhost:3000/api/file/',
      MATERIAL_VIEW_VIDEO_URL: 'http://localhost:4200/material/view/video/',
      MATERIAL_VIEW_PDF_URL: 'http://localhost:4200/material/view/pdf/'
    }
  }

module.exports = urls
