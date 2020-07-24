let hasCapture = false;
let captured = false;
let isTrackMaterial = false;

if ($("#capture-dialog").val() === 'true') {
  hasCapture = true;
}
if($("#activity").val() != 'undefined' && $("#contact").val() != 'undefined') {
  isTrackMaterial = true;
}

$(".widget-action.interesting").click(function() {
  if (hasCapture && captured) {
    likeWithContact()  
    // API Update
  }
  if (hasCapture && !captured) {
    $("#interestModal").modal({backdrop: 'static', keyboard: false})
  }
  if (!hasCapture) {
    if (isTrackMaterial) {
      likeWithContact()
    } else {
      $("#interestModal").modal({backdrop: 'static', keyboard: false})
    }
  }
});

function likeWithContact() {
  let contact = $('#contact').val();
  let material = $('#material').val();
  let materialType = $('#material-type').val();
  let user = $('#user').val();

  $(".widget-action.interesting").addClass('loading');
  $.ajax({
    type: 'POST',
    url: 'api/contact/interest-submit',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({contact, material, materialType, user}),
    success: function (data) {
      $(".widget-action.interesting").removeClass('loading');
      const response = data.data;
      if (response) {
        if(!socket) {
          var siteAddr = location.protocol + '//' + location.hostname;
          // var siteAddr = "http://localhost:3000";
          socket = io.connect(siteAddr);
        }
      }
    },
    error: function (data) {
      $(".widget-action.interesting").removeClass('loading');
      if (data.status == 400) {
        const response = data.responseJSON;
        if (response && response['error']) {
          alert(response['error']);
        } else {
          alert('Internal Server Error');
        }
      } else {
        alert('Internal Server Error');
      }
    },
  });
}


$('#interest-form').submit((e) => {
  e.preventDefault();
  var formData = $("#interest-form").serializeArray();
  var data = {};
  formData.forEach((e) => {
    data[e['name']] = e['value'];
  });
  let materialType = $('#material-type').val();
  data['materialType'] = materialType;
  $('#interest-form .btn').addClass('loading');
  $('#interest-form .btn').text('Please wait...');

  $.ajax({
    type: 'POST',
    url: 'api/contact/interest',
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(data),
    success: function (data) {
      const response = data.data;
      if (response) {
        $('#contact').val(response.contact);
        $('#activity').val(response.activity);
        if(!socket) {
          var siteAddr = location.protocol + '//' + location.hostname;
          // var siteAddr = "http://localhost:3000";
          socket = io.connect(siteAddr);
        }
      }
      $('#interest-form .btn').removeClass('loading');
      $('#interest-form .btn').text('I\'M INTERESTED');
      $('#interestModal').modal('hide');
      captured = true;
    },
    error: function (data) {
      $('#interest-form .btn').removeClass('loading');
      $('#interest-form .btn').text('I\'M INTERESTED');
      if (data.status == 400) {
        const response = data.responseJSON;
        if (response && response['error']) {
          alert(response['error']);
        } else {
          alert('Internal Server Error');
        }
      } else {
        alert('Internal Server Error');
      }
    },
  });
})
