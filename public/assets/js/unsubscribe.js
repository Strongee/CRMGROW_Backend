
(function ($) {
    $(document).ready(function () {
      document.querySelector(".button").addEventListener('click', function(){
        let params = (new URL(document.location)).searchParams;
        let activity = params.get('activity');
        
        $.ajax({
            type: 'GET',
            url: `api/unsubscribe/${activity}`,
            headers: {
              'Content-Type': 'application/json',
            },
            success: function (data) {
              const response = data.data;
              console.log('data', data);
              if (response && response.status) {
                $('#unsubscribe-content').removeClass('content-hide');
                $('#subscribe-content').addClass('content-hide');
              }
            },
          });
      }, true);
    })
})(jQuery);