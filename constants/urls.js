const urls = () => {
  let urls;
  if(process.env.NODE_ENV === 'production') {
    urls = {
      DOMAIN_URL: 'https://teamgrow.co/',
      API_URL: 'https://teamgrow.co/api',
      EMAIL_AUTHORIZE_URL: 'https://teamgrow.co/api/user/authorize-outlook',
      VIDEO_THUMBNAIL_URL:  'https://teamgrow.co/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'https://teamgrow.co/api/pdf/preview/',
      FILE_URL: 'https://teamgrow.co/api/file/',
      MATERIAL_VIEW_VIDEO_URL: 'https://teamgrow.co/material/view/video/',
      MATERIAL_VIEW_PDF_URL: 'https://teamgrow.co/material/view/pdf/'
    }
  } else {
    urls = {
      DOMAIN_URL: 'http://localhost:4200/',
      API_URL: 'http://localhost:3000/api',
      EMAIL_AUTHORIZE_URL: 'http://localhost:3000/api/user/authorize-outlook',
      VIDEO_THUMBNAIL_URL: 'http://localhost:3000/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'http://localhost:3000/api/pdf/preview/',
      FILE_URL: 'http://localhost:3000/api/file/',
      MATERIAL_VIEW_VIDEO_URL: 'http://localhost:4200/material/view/video/',
      MATERIAL_VIEW_PDF_URL: 'http://localhost:4200/material/view/pdf/'
    }
  }
  return urls
}


module.exports = urls
