  if(process.env.NODE_ENV === 'production') {
    urls = {
      DOMAIN_URL: 'http://18.220.168.230/',
      API_URL: 'http://18.220.168.230/api',
      EMAIL_AUTHORIZE_URL: 'http://18.220.168.230/api/user/authorize-outlook',
      VIDEO_THUMBNAIL_URL:  'http://18.220.168.230/api/video/thumbnail/',
      PDF_PREVIEW_URL: 'http://18.220.168.230/api/pdf/preview/',
      FILE_URL: 'http://18.220.168.230/api/file/',
      MATERIAL_VIEW_VIDEO_URL: 'http://18.220.168.230/material/view/video/',
      MATERIAL_VIEW_PDF_URL: 'http://18.220.168.230/material/view/pdf/'
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

module.exports = urls
