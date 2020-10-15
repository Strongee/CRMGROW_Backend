let url = new URL(location.href);
let params = Qs.parse(url.search.substr(1));
if(params.code) {
  var settings = {
    "url": "api/user/social-gmail?code=" + params.code,
    "method": "GET",
    headers: {
      'Content-Type': 'application/json',
    },
    success: (data) => {

    },
    error: (error) => {

    } 
  };
  $.ajax(settings)
} else {
  $('.status').html("Sign in Failed");
}