
(function ($) {
    $(document).ready(function () {
        $(".button").click(e => {
            let params = (new URL(document.location)).searchParams;
            let activity = params.get('activity');

            $.ajax({
                type: 'POST',
                url: `api/unsubscribe/${activity}`,
                headers: {
                  'Content-Type': 'application/json',
                },
                data: JSON.stringify(data),
                success: function (data) {
                  const response = data.data;
                  if (response) {
                    $('#unsubscribe-content').removeClass('content-hide');
                    $('#subscribe-content').addClass('content-hide');
                  }
                },
              });
        });
    })
})(jQuery);