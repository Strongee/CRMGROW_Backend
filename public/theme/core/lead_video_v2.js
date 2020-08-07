var registered_flag = false;
var reported = false;
var socket;
var vPlayer = new Plyr('#player');
var trackingTimes = [];
var startOverlapFlag = false;
var endOverlapFlag = false;
var currentTrackerIndex = 0;
var seek_flag = false;
var watched_time = 0;
var duration = document.querySelector('#duration').value;
var limit = duration
if(duration > 600) {
  limit = duration - 5
} else {
  limit = duration - 3
}

(function ($) {
  $(document).ready(function () {
    let delayTime = parseInt($('#capture-delay').val());
    let showable = $('#capture-dialog').val();
    if (showable == 'true') {
      if (delayTime) {
        setTimeout(() => {
          if(!captured) {
            // Show The Modal & BackDrop
            $('#leadModal').modal({backdrop: 'static', keyboard: false});
            // Protect the Body Form
            $('body').addClass('is_protected');
            // Pause the Video
            vPlayer.pause();
          }
        }, delayTime * 60000);
      } else {
        $('#leadModal').modal({backdrop: 'static', keyboard: false});
        // Protect the Body Form
        $('body').addClass('is_protected');
      }
    }

    // var cleave = new Cleave('input.phone-info', {
    //   numericOnly: true,
    //   blocks: [0, 3, 3, 4],
    //   delimiters: ['(', ') ', '-'],
    // });

    $('#info-form').submit((e) => {
      e.preventDefault();
      var formData = $('#info-form').serializeArray();
      var data = {};
      formData.forEach((e) => {
        data[e['name']] = e['value'];
      });
      $('#info-form .btn').addClass('loading');
      $('#info-form .btn').text('Please wait...');
      $.ajax({
        type: 'POST',
        url: 'api/contact/lead',
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(data),
        success: function (data) {
          const response = data.data;
          if (response) {
            if(document.querySelector(".intro_video")) {
              document.querySelector(".intro_video").muted = true
              document.querySelector(".intro_video").pause();
            }
            $('#contact').val(response.contact);
            $('#activity').val(response.activity);
            var siteAddr = location.protocol + '//' + location.hostname;
            // var siteAddr = "http://localhost:3000";
            socket = io.connect(siteAddr);
            vPlayer.play();
            if(updateInterested) {
              updateInterested();
            }
          }
          $('#info-form .btn').removeClass('loading');
          $('#info-form .btn').text('Submit');
          $('body').removeClass('is_protected');
          $('#leadModal').modal('hide');
          captured = true;
        },
        error: function (data) {
          $('#info-form .btn').removeClass('loading');
          $('#info-form .btn').text('Submit');
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
    });

    $(".quick-video-wrapper .volume-control").click(e => {
      let volumnStatus = document.querySelector(".intro_video").muted;
      document.querySelector(".intro_video").muted = !volumnStatus
      if(volumnStatus) {
        $(".quick-video-wrapper .volume-control img").attr("src", "./theme/icons/mute.png")
      }
      else {
        $(".quick-video-wrapper .volume-control img").attr("src", "./theme/icons/unmute.png")
      }
    })
  });
})(jQuery);

function updateStartTime() {
  let currentTime = vPlayer.currentTime;
  for (let i = 0; i < trackingTimes.length; i++) {
    if (
      trackingTimes[i][0] <= currentTime &&
      currentTime <= trackingTimes[i][1]
    ) {
      currentTrackerIndex = i;
      startOverlapFlag = true;
      return;
    }
  }
  trackingTimes.push([currentTime]);
  currentTrackerIndex = trackingTimes.length - 1;
  startOverlapFlag = false;
}

function updateEndTime() {
  let currentTime = vPlayer.currentTime;
  if (startOverlapFlag == false) {
    // TODO : Can update the start index as current tracker for Better algorithm
    for (let i = 0; i < trackingTimes.length; i++) {
      if (i != currentTrackerIndex && trackingTimes[i][1]) {
        if (
          trackingTimes[i][0] <= currentTime &&
          currentTime <= trackingTimes[i][1] &&
          i != currentTrackerIndex
        ) {
          trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1];
          trackingTimes.splice(i, 1);
          if (i < currentTrackerIndex) {
            currentTrackerIndex--;
          }
          return;
        }
      }
    }
    if (
      trackingTimes[currentTrackerIndex] &&
      trackingTimes[currentTrackerIndex][1] != null &&
      trackingTimes[currentTrackerIndex][1] != undefined
    ) {
      trackingTimes[currentTrackerIndex][1] = currentTime;
    } else if (trackingTimes[currentTrackerIndex]) {
      trackingTimes[currentTrackerIndex].push(currentTime);
    }
  } else {
    if (currentTime <= trackingTimes[currentTrackerIndex][1]) {
      return;
    } else {
      for (let i = 0; i < trackingTimes.length; i++) {
        if (i != currentTrackerIndex && trackingTimes[i][1]) {
          if (
            trackingTimes[i][0] <= currentTime &&
            currentTime <= trackingTimes[i][1] &&
            i != currentTrackerIndex
          ) {
            trackingTimes[currentTrackerIndex][1] = trackingTimes[i][1];
            trackingTimes.splice(i, 1);
            if (i < currentTrackerIndex) {
              currentTrackerIndex--;
            }
            return;
          }
        }
      }
      if (
        trackingTimes[currentTrackerIndex][1] != null &&
        trackingTimes[currentTrackerIndex][1] != undefined
      ) {
        trackingTimes[currentTrackerIndex][1] = currentTime;
      } else if (trackingTimes[currentTrackerIndex]) {
        trackingTimes[currentTrackerIndex].push(currentTime);
      }
    }
  }
}

function reportTime() {
  var total = 0;
  trackingTimes.forEach((e) => {
    if (e[1]) {
      total += e[1] - e[0];
    }
  });
  watched_time = total;
  if (total != 0 && socket) {
    if (watched_time < limit) {
      if (!registered_flag) {
        const video = document.querySelector('#material').value;
        const user = document.querySelector('#user').value;
        const contact = document.querySelector('#contact').value;
        const activity = document.querySelector('#activity').value;
        var report = {
          video,
          user,
          contact,
          activity,
          duration: 0,
          material_last: vPlayer.currentTime
        };
        registered_flag = true;
        socket.emit('init_video', report);
      } else {
        socket.emit('update_video', {
          duration: total * 1000,
          material_last: vPlayer.currentTime
        });
      }
    } else {
      if (!reported) {
        let currentTime = vPlayer.currentTime;
        if(currentTime > limit - 2 ) {
          currentTime = 0;
        }
        socket.emit('update_video', {
          duration: duration * 1000,
          material_last: currentTime
        });
        socket.emit('close');
        reported = true;
      }
    }
  }
}

vPlayer.on('playing', function () {
  if (seek_flag || watched_time == 0) {
    updateStartTime();
    seek_flag = false;
  }
});

vPlayer.on('timeupdate', function () {
  if (vPlayer.seeking || seek_flag) {
    seek_flag = true;
  } else {
    seek_flag = false;
    updateEndTime();
    reportTime();
  }
});

vPlayer.on('seeking', () => {
  seek_flag = true;
});
