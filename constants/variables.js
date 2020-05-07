let urls
if(process.env.NODE_ENV === 'production') {
  urls = {
    DEFAULT_LOGO: 'https://app.crmgrow.com/theme/images/default_logo.png'
  }
} else if(process.env.NODE_ENV === 'staging'){
  urls = {
    DEFAULT_LOGO: 'https://stage.crmgrow.com/theme/images/default_logo.png'
  }
}else {
  urls = {
    DEFAULT_LOGO: 'http://localhost:3000/theme/images/default_logo.png'
  }
}

module.exports = urls
