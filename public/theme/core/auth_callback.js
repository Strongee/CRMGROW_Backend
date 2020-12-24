let url = new URL(location.href);
let params = Qs.parse(url.hash.substr(1));

const socialType = $("#social_type").val();
if (socialType === 'google') {
  if(params.code) {
    var settings = {
      "url": "api/user/app-google-signin?code=" + params.code,
      "method": "GET",
      headers: {
        'Content-Type': 'application/json',
      },
      success: (response) => {
        if (response.status) {
          token = response.data.token;
          user = response.data.user;
          // SHOW SUCCESS
          $('.success.status').removeClass('d-none');
          $('.status.progressing').addClass('d-none');
          // CHANGE URL
          window.history.pushState("", "", url.origin + url.pathname + '?success');
          // OPEN APP
          $('.openApp').attr('href', `crmrecord://signin?token=${token}&id=${user}`);
          document.querySelector(".openApp").click();
        }
      },
      error: (error) => {
        window.history.pushState("", "", url.origin + url.pathname + '?error');
        // SHOW ERROR
        $('.error.status').removeClass('d-none');
        $('.status.progressing').addClass('d-none');
      } 
    };
    $.ajax(settings);
    // Show Loading
  } else {

  }
} else {
  if(params.client_info) {
    let client_info = params.client_info;
    if(client_info) {
      client_info = client_info.replaceAll("-", "+");
      client_info = client_info.replaceAll("_", "/");
      try {
        let userInfo = JSON.parse(atob(client_info));
        if (userInfo && userInfo.oid) {
          var settings = {
            "url": "api/user/app-outlook-signin?code=" + userInfo.oid,
            "method": "GET",
            headers: {
              'Content-Type': 'application/json',
            },
            success: (response) => {
              if (response.status) {
                token = response.data.token;
                user = response.data.user;
                // SHOW SUCCESS
                $('.success.status').removeClass('d-none');
                $('.status.progressing').addClass('d-none');
                // CHANGE URL
                window.history.pushState("", "", url.origin + url.pathname + '?success');
                // OPEN APP
                $('.openApp').attr('href', `crmrecord://signin?token=${token}&id=${user}`);
                document.querySelector(".openApp").click();
              }
            },
            error: (error) => {
              window.history.pushState("", "", url.origin + url.pathname + '?error');
              // SHOW ERROR
              $('.error.status').removeClass('d-none');
              $('.status.progressing').addClass('d-none');
            } 
          };
          $.ajax(settings);
          // Show Loading
        }
      } catch (err) {
        console.log("user info token Error", err);
        window.history.pushState("", "", url.origin + url.pathname + '?error');
      }
    } else {
      console.log('token is incorrect')
      window.history.pushState("", "", url.origin + url.pathname + '?error');
    }
  } else {
    console.log('token is not exist')
  }
}